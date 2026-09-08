import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { brand } from '@autoparts/shared';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Entirely optional, same pattern as AiCategorizationService: without
 * RESEND_API_KEY configured, every send is a no-op that resolves
 * successfully rather than throwing -- an order or status update must
 * never fail because a notification email couldn't go out.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('RESEND_API_KEY'));
  }

  private async send({ to, subject, html }: SendEmailInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) return;

    // resend.dev's shared address works with zero setup -- good enough
    // to start sending immediately. Once a real domain is verified with
    // Resend, set FROM_EMAIL to send as that domain instead.
    const from = this.config.get<string>(
      'FROM_EMAIL',
      `${brand.shortName} <onboarding@resend.dev>`,
    );

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Resend rejected an email to ${to}: ${res.status} ${await res.text()}`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to send email to ${to}: ${String(err)}`);
    }
  }

  async sendNewOrderEmail(
    to: string,
    order: { orderNumber: string; total: string; customerName: string },
  ): Promise<void> {
    await this.send({
      to,
      subject: `New order ${order.orderNumber} — ${brand.shortName}`,
      html: `
        <p>You have a new order.</p>
        <p><strong>Order:</strong> ${order.orderNumber}<br>
        <strong>Customer:</strong> ${order.customerName}<br>
        <strong>Total:</strong> $${order.total} JMD</p>
        <p>Log in to your supplier dashboard to view the full order and update its status once you've confirmed payment.</p>
      `,
    });
  }

  async sendOrderStatusEmail(
    to: string,
    order: { orderNumber: string; status: string; supplierName: string },
  ): Promise<void> {
    const statusLabel = order.status.replaceAll('_', ' ').toLowerCase();
    await this.send({
      to,
      subject: `Order ${order.orderNumber} update — ${statusLabel}`,
      html: `
        <p>Your order <strong>${order.orderNumber}</strong> from ${order.supplierName} is now: <strong>${statusLabel}</strong>.</p>
        <p>Log in to your account to see the full order details.</p>
      `,
    });
  }
}
