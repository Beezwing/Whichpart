import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { QuickBooksService } from './quickbooks.service';

interface OAuthState {
  supplierId: string;
  exp: number;
}

@Controller('quickbooks')
export class QuickBooksController {
  private readonly logger = new Logger(QuickBooksController.name);

  constructor(
    private readonly quickbooks: QuickBooksService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  private async requireSupplierId(userId: string): Promise<string> {
    const supplierUser = await this.prisma.supplierUser.findFirst({
      where: { userId },
      select: { supplierId: true },
    });
    if (!supplierUser)
      throw new BadRequestException('No supplier account found for this user.');
    return supplierUser.supplierId;
  }

  private get webAppOrigin(): string {
    return this.config.get<string>('WEB_APP_ORIGIN', 'http://localhost:3000');
  }

  @Get('status')
  @Auth()
  async status(@CurrentUser() user: AuthenticatedUser) {
    const supplierId = await this.requireSupplierId(user.id);
    const [account, locations] = await Promise.all([
      this.prisma.supplierQuickBooksAccount.findUnique({
        where: { supplierId },
      }),
      this.prisma.supplierLocation.findMany({
        where: { supplierId },
        select: { id: true, name: true },
      }),
    ]);
    return {
      configured: this.quickbooks.isConfigured(),
      connected: !!account,
      realmId: account?.realmId ?? null,
      primaryLocationId: account?.primaryLocationId ?? null,
      lastSyncedAt: account?.lastSyncedAt ?? null,
      lastSyncError: account?.lastSyncError ?? null,
      locations,
    };
  }

  @Get('connect')
  @Auth()
  async connect(@CurrentUser() user: AuthenticatedUser) {
    if (!this.quickbooks.isConfigured()) {
      throw new BadRequestException(
        "QuickBooks isn't set up on this marketplace yet.",
      );
    }
    const supplierId = await this.requireSupplierId(user.id);
    // Stateless, signed, and short-lived rather than a server-side session
    // record -- Intuit's redirect back to /callback below isn't guaranteed
    // to carry our auth cookie, so this state value is the only thing that
    // ties that request back to a specific supplier, and it must not be
    // forgeable (Section: OAuth CSRF).
    const payload: OAuthState = {
      supplierId,
      exp: Date.now() + 10 * 60 * 1000,
    };
    const state = this.crypto.encrypt(JSON.stringify(payload));
    return { url: this.quickbooks.getAuthorizationUrl(state) };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('realmId') realmId: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const redirect = (result: 'connected' | 'error') =>
      res.redirect(
        `${this.webAppOrigin}/supplier/quickbooks?quickbooks=${result}`,
      );

    if (oauthError || !code || !realmId || !state) return redirect('error');

    let payload: OAuthState;
    try {
      payload = JSON.parse(this.crypto.decrypt(state)) as OAuthState;
    } catch {
      this.logger.warn(
        'QuickBooks callback received an unverifiable state value.',
      );
      return redirect('error');
    }
    if (payload.exp < Date.now()) {
      this.logger.warn('QuickBooks callback state had expired.');
      return redirect('error');
    }

    const tokens = await this.quickbooks.exchangeCodeForTokens(code);
    if (!tokens) return redirect('error');

    await this.prisma.supplierQuickBooksAccount.upsert({
      where: { supplierId: payload.supplierId },
      create: {
        supplierId: payload.supplierId,
        realmId,
        encryptedAccessToken: this.crypto.encrypt(tokens.accessToken),
        encryptedRefreshToken: this.crypto.encrypt(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
      update: {
        realmId,
        encryptedAccessToken: this.crypto.encrypt(tokens.accessToken),
        encryptedRefreshToken: this.crypto.encrypt(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        lastSyncError: null,
      },
    });

    return redirect('connected');
  }

  @Post('primary-location')
  @Auth()
  async setPrimaryLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body('locationId') locationId: string,
  ) {
    const supplierId = await this.requireSupplierId(user.id);
    const location = await this.prisma.supplierLocation.findFirst({
      where: { id: locationId, supplierId },
    });
    if (!location)
      throw new BadRequestException(
        'That location does not belong to your account.',
      );

    const account = await this.prisma.supplierQuickBooksAccount.update({
      where: { supplierId },
      data: { primaryLocationId: locationId },
    });
    return { primaryLocationId: account.primaryLocationId };
  }

  @Delete('disconnect')
  @Auth()
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    const supplierId = await this.requireSupplierId(user.id);
    await this.prisma.supplierQuickBooksAccount
      .delete({ where: { supplierId } })
      .catch(() => undefined);
    return { disconnected: true };
  }

  /**
   * Public, unauthenticated -- Intuit's servers call this, not a logged-in
   * user. Every notification is signature-checked against the raw request
   * body (main.ts enables rawBody specifically for this) before it's
   * trusted at all, and even then it's only ever treated as a trigger to
   * re-fetch the real quantity ourselves (pullFromWebhookEntity), never as
   * an authoritative value on its own -- same principle as the DimePay
   * webhook.
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const signature = req.headers['intuit-signature'] as string | undefined;
    const raw = req.rawBody?.toString('utf8') ?? '';
    if (!this.quickbooks.verifyWebhookSignature(raw, signature)) {
      this.logger.warn(
        'QuickBooks webhook received with an invalid signature -- ignored.',
      );
      return { received: true };
    }

    const body = req.body as {
      eventNotifications?: {
        realmId: string;
        dataChangeEvent?: { entities?: { name: string; id: string }[] };
      }[];
    };
    for (const notification of body.eventNotifications ?? []) {
      for (const entity of notification.dataChangeEvent?.entities ?? []) {
        if (entity.name !== 'Item') continue;
        await this.quickbooks
          .pullFromWebhookEntity(notification.realmId, entity.id)
          .catch((err: unknown) =>
            this.logger.warn(`QuickBooks webhook sync failed: ${String(err)}`),
          );
      }
    }
    return { received: true };
  }
}
