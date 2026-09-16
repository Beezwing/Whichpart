import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import type { SupplierQuickBooksAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * QuickBooks Online sync (Section: QuickBooks two-way inventory sync). Like
 * DimePayService, entirely optional -- isConfigured() gates everything, so a
 * deploy without a QuickBooks app registered just leaves this feature
 * unavailable rather than broken.
 *
 * Two-way by design: this service both PUSHES a product's quantity to
 * QuickBooks whenever it changes here (see products.service.ts), and
 * exposes the pieces (webhook signature check, item fetch/update) that
 * quickbooks.controller.ts uses to PULL a change made in QuickBooks back
 * down here. QuickBooks itself has only one "Quantity on Hand" per item --
 * it has no concept of our multiple supplier locations -- so every push
 * sends the sum across all of a product's locations, and every pull
 * applies the resulting difference to the supplier's chosen primary
 * location (see SupplierQuickBooksAccount.primaryLocationId).
 *
 * No `intuit-oauth`/`node-quickbooks` package -- raw fetch() throughout,
 * consistent with how DimePay, Resend, and Anthropic are called elsewhere
 * in this codebase.
 */
@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>('QUICKBOOKS_CLIENT_ID') &&
      this.config.get<string>('QUICKBOOKS_CLIENT_SECRET')
    );
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>('QUICKBOOKS_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('QUICKBOOKS_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    const apiPublicUrl = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:4000/api',
    );
    return `${apiPublicUrl}/quickbooks/callback`;
  }

  private get apiBaseUrl(): string {
    // Sandbox and production are entirely separate QuickBooks environments
    // (separate company data, separate app approval) -- keyed off its own
    // var rather than NODE_ENV, since a deploy can validly need to point at
    // either while it's still short of Intuit's production review.
    return this.config.get<string>('QUICKBOOKS_ENVIRONMENT') === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  /** Where a supplier is sent to approve access; `state` round-trips through
   * Intuit unchanged, so the callback can tie the redirect back to the
   * supplier who started it. */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: SCOPE,
      redirect_uri: this.redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  private async requestTokens(
    body: Record<string, string>,
  ): Promise<QuickBooksTokens | null> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(body),
    });
    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
    } | null;
    if (!res.ok || !data?.access_token || !data.refresh_token) {
      this.logger.warn(
        `QuickBooks token request failed: ${res.status} ${JSON.stringify(data)}`,
      );
      return null;
    }
    const now = Date.now();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: new Date(now + (data.expires_in ?? 3600) * 1000),
      refreshTokenExpiresAt: new Date(
        now + (data.x_refresh_token_expires_in ?? 100 * 24 * 3600) * 1000,
      ),
    };
  }

  exchangeCodeForTokens(code: string): Promise<QuickBooksTokens | null> {
    return this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });
  }

  private refreshTokens(
    refreshToken: string,
  ): Promise<QuickBooksTokens | null> {
    return this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /** Refreshes and persists a new access token if the stored one is at or
   * past expiry, then returns a live access token either way. Returns null
   * (rather than throwing) on failure so callers can no-op a sync attempt
   * instead of crashing the request that triggered it. */
  private async ensureFreshAccessToken(
    account: SupplierQuickBooksAccount,
  ): Promise<string | null> {
    if (account.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
      return this.crypto.decrypt(account.encryptedAccessToken);
    }
    const refreshToken = this.crypto.decrypt(account.encryptedRefreshToken);
    const tokens = await this.refreshTokens(refreshToken);
    if (!tokens) return null;
    await this.prisma.supplierQuickBooksAccount.update({
      where: { id: account.id },
      data: {
        encryptedAccessToken: this.crypto.encrypt(tokens.accessToken),
        encryptedRefreshToken: this.crypto.encrypt(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    });
    return tokens.accessToken;
  }

  private async request(
    account: SupplierQuickBooksAccount,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    const accessToken = await this.ensureFreshAccessToken(account);
    if (!accessToken) {
      return { ok: false, status: 401, data: null };
    }
    const res = await fetch(
      `${this.apiBaseUrl}/v3/company/${account.realmId}${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const data: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  /** QuickBooks' own optimistic-concurrency id for one Item -- every update
   * must send the SyncToken it last returned, or the update is rejected. */
  async getItem(
    account: SupplierQuickBooksAccount,
    qbItemId: string,
  ): Promise<{
    id: string;
    syncToken: string;
    name: string;
    qtyOnHand: number;
  } | null> {
    const res = await this.request(
      account,
      'GET',
      `/item/${qbItemId}?minorversion=65`,
    );
    if (!res.ok) return null;
    const item = (res.data as { Item?: Record<string, unknown> })?.Item;
    if (!item) return null;
    return {
      id: String(item.Id),
      syncToken: String(item.SyncToken),
      name: String(item.Name),
      qtyOnHand: Number(item.QtyOnHand ?? 0),
    };
  }

  /** Finds an inventory Item by SKU, for a supplier matching a Which Part?
   * product to a QuickBooks item for the first time. */
  async findItemBySku(
    account: SupplierQuickBooksAccount,
    sku: string,
  ): Promise<{
    id: string;
    syncToken: string;
    name: string;
    qtyOnHand: number;
  } | null> {
    const escaped = sku.replace(/'/g, "\\'");
    const res = await this.request(
      account,
      'GET',
      `/query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Sku = '${escaped}'`)}&minorversion=65`,
    );
    if (!res.ok) return null;
    const items = (
      res.data as { QueryResponse?: { Item?: Record<string, unknown>[] } }
    )?.QueryResponse?.Item;
    const item = items?.[0];
    if (!item) return null;
    return {
      id: String(item.Id),
      syncToken: String(item.SyncToken),
      name: String(item.Name),
      qtyOnHand: Number(item.QtyOnHand ?? 0),
    };
  }

  /** Pushes a new total quantity to QuickBooks (Which Part? -> QuickBooks
   * direction). Sparse update: only the changed field plus the required
   * Id/SyncToken pair, per QuickBooks' own convention for partial updates. */
  async updateItemQuantity(
    account: SupplierQuickBooksAccount,
    qbItemId: string,
    syncToken: string,
    newQuantity: number,
  ): Promise<{ syncToken: string } | null> {
    const res = await this.request(account, 'POST', '/item?minorversion=65', {
      Id: qbItemId,
      SyncToken: syncToken,
      sparse: true,
      QtyOnHand: newQuantity,
    });
    if (!res.ok) {
      this.logger.warn(
        `QuickBooks item update failed for item ${qbItemId}: ${res.status} ${JSON.stringify(res.data)}`,
      );
      return null;
    }
    const item = (res.data as { Item?: Record<string, unknown> })?.Item;
    return item ? { syncToken: String(item.SyncToken) } : null;
  }

  /** Intuit signs every webhook body with the app's Webhooks Verifier Token
   * (HMAC-SHA256, base64) in the `intuit-signature` header -- this is the
   * only way to tell a real QuickBooks notification from a forged POST to
   * the same public endpoint. */
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | undefined,
  ): boolean {
    const verifierToken = this.config.get<string>(
      'QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN',
    );
    if (!verifierToken || !signatureHeader) return false;
    const expected = createHmac('sha256', verifierToken)
      .update(rawBody)
      .digest('base64');
    return expected === signatureHeader;
  }

  static newState(): string {
    return randomUUID();
  }

  /**
   * Which Part? -> QuickBooks. Called after every inventory quantity change
   * (see products.service.ts) with the product's fresh total across every
   * location. Best-effort and silent on failure -- a QuickBooks hiccup must
   * never block the supplier's own inventory update from succeeding, same
   * spirit as DimePay's checkout-side calls.
   */
  async pushProductQuantity(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventory: true,
        supplier: { include: { quickBooksAccount: true } },
      },
    });
    const account = product?.supplier.quickBooksAccount;
    if (!product || !account) return;

    const totalQuantity = product.inventory.reduce(
      (sum, i) => sum + i.quantity,
      0,
    );

    let qbItemId = product.qbItemId;
    let syncToken = product.qbSyncToken;
    if (!qbItemId) {
      const match = await this.findItemBySku(account, product.sku);
      if (!match) {
        this.logger.warn(
          `No QuickBooks item found with SKU ${product.sku} for product ${product.id} -- not linked, skipping push.`,
        );
        return;
      }
      qbItemId = match.id;
      syncToken = match.syncToken;
    }

    const result = await this.updateItemQuantity(
      account,
      qbItemId,
      syncToken ?? '0',
      totalQuantity,
    );
    if (!result) return;

    await this.prisma.product.update({
      where: { id: product.id },
      data: { qbItemId, qbSyncToken: result.syncToken },
    });
    await this.prisma.supplierQuickBooksAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
  }

  /**
   * QuickBooks -> Which Part?. Called by the webhook receiver when Intuit
   * reports an Item changed. Re-fetches the item's real quantity (never
   * trusts the webhook body's own claim, same principle as the DimePay
   * webhook) and applies the difference from what Which Part? has on file
   * to the supplier's designated primary location -- the only location we
   * have any basis to adjust, since QuickBooks itself has no per-location
   * breakdown to tell us which one actually changed.
   */
  async pullFromWebhookEntity(
    realmId: string,
    qbItemId: string,
  ): Promise<void> {
    const account = await this.prisma.supplierQuickBooksAccount.findFirst({
      where: { realmId },
    });
    if (!account) return;

    const product = await this.prisma.product.findFirst({
      where: { supplierId: account.supplierId, qbItemId },
      include: { inventory: true },
    });
    if (!product) return;

    const item = await this.getItem(account, qbItemId);
    if (!item) return;

    const currentTotal = product.inventory.reduce(
      (sum, i) => sum + i.quantity,
      0,
    );
    const delta = item.qtyOnHand - currentTotal;
    if (delta === 0) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { qbSyncToken: item.syncToken },
      });
      return;
    }

    if (!account.primaryLocationId) {
      this.logger.warn(
        `QuickBooks reported a quantity change for product ${product.id} but supplier ${account.supplierId} has no primary location set -- can't apply it. Set one from the QuickBooks settings page.`,
      );
      await this.prisma.supplierQuickBooksAccount.update({
        where: { id: account.id },
        data: {
          lastSyncError:
            'A QuickBooks quantity change came in but no primary location is set to apply it to.',
        },
      });
      return;
    }

    const primaryInventory = product.inventory.find(
      (i) => i.locationId === account.primaryLocationId,
    );
    const newPrimaryQuantity = Math.max(
      0,
      (primaryInventory?.quantity ?? 0) + delta,
    );

    await this.prisma.inventoryLocation.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: account.primaryLocationId,
        },
      },
      create: {
        productId: product.id,
        locationId: account.primaryLocationId,
        quantity: newPrimaryQuantity,
      },
      update: { quantity: newPrimaryQuantity },
    });
    await this.prisma.product.update({
      where: { id: product.id },
      data: { qbSyncToken: item.syncToken },
    });
    await this.prisma.supplierQuickBooksAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
  }
}
