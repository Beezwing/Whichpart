import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { DimePayService } from './dimepay.service';

/**
 * Public, unauthenticated -- DimePay's own servers call this, not a
 * logged-in user. DimePay's docs don't document a webhook signature
 * scheme, so the body here is never trusted directly (Rule 13/14, same
 * spirit as never trusting client-submitted price/quantity): it's only
 * ever a trigger to go re-fetch the real order status ourselves, using
 * our own stored signing secret. A forged POST to this endpoint can at
 * worst make us re-check a real order's real status -- it can't forge
 * a paid order on its own.
 */
@Controller('webhooks/dimepay')
export class DimePayWebhookController {
  private readonly logger = new Logger(DimePayWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly dimePay: DimePayService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Body() body: Record<string, unknown>) {
    // We set both `id` and `referenceTransactionId` to our own Order.id
    // when creating the checkout, so accept whichever DimePay's webhook
    // body actually echoes back.
    const orderId =
      (body.referenceTransactionId as string | undefined) ??
      (body.entity_display_id as string | undefined) ??
      (body.id as string | undefined);

    if (!orderId) {
      this.logger.warn(
        `DimePay webhook received with no recognizable order reference: ${JSON.stringify(body).slice(0, 500)}`,
      );
      return { received: true };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        supplier: { include: { paymentAccount: true } },
      },
    });
    if (!order) {
      this.logger.warn(`DimePay webhook referenced unknown order ${orderId}`);
      return { received: true };
    }

    const payment = order.payments.find((p) => p.provider === 'DIMEPAY');
    const account = order.supplier.paymentAccount;
    if (
      !payment?.providerReference ||
      !account?.encryptedApiKey ||
      !account.encryptedApiSecret
    ) {
      this.logger.warn(
        `DimePay webhook for order ${orderId} but no matching payment/credentials on file`,
      );
      return { received: true };
    }

    // Always re-fetch the authoritative status ourselves -- never trust
    // the webhook body's own claimed status.
    const status = await this.dimePay.getOrderStatus(
      {
        clientKey: this.crypto.decrypt(account.encryptedApiKey),
        signingSecret: this.crypto.decrypt(account.encryptedApiSecret),
      },
      payment.providerReference,
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { rawWebhookPayload: body as Prisma.InputJsonValue },
    });

    if (status?.status === 'COMPLETE' && order.status === 'AWAITING_PAYMENT') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentStatus: 'PAID' },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID' },
      });
      this.logger.log(
        `Order ${order.orderNumber} confirmed PAID via DimePay webhook.`,
      );
    }

    return { received: true };
  }
}
