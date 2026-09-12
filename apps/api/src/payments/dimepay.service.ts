import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

export interface DimePayCredentials {
  clientKey: string;
  signingSecret: string;
}

export interface DimePayOrderItem {
  id: string;
  name: string;
  price: number;
  sku: string;
  quantity: number;
}

export interface CreateHostedCheckoutInput {
  orderId: string;
  total: number;
  currency: string;
  customerEmail: string;
  items: DimePayOrderItem[];
  referenceTransactionId: string;
}

export interface DimePayOrderStatus {
  status: string;
  raw: unknown;
}

/**
 * DimePay's own docs (docs.dimepay.net) don't document a webhook
 * signature/verification scheme, so a webhook payload is never trusted
 * on its own here -- it's only ever a trigger to re-fetch the real
 * status via getOrderStatus(), which requires our own signing secret to
 * even construct the request. See dimepay-webhook.controller.ts.
 *
 * Entirely optional, same isConfigured() pattern as AiCategorizationService
 * and EmailService: a supplier without both DimePay credentials just
 * doesn't get hosted-checkout wired in, checkout falls back to the
 * existing manual "supplier confirms payment" flow.
 */
@Injectable()
export class DimePayService {
  private readonly logger = new Logger(DimePayService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    // DimePay's own docs disagree with themselves on the sandbox host
    // (api.dimepay.app vs api.dimepay.com) -- this is the one they use
    // in every actual code sample, so it's the one to trust.
    return this.config.get<string>('NODE_ENV') === 'production'
      ? 'https://api.dimepay.app/dapi/v1'
      : 'https://sandbox.api.dimepay.app/dapi/v1';
  }

  private get webAppOrigin(): string {
    return this.config.get<string>('WEB_APP_ORIGIN', 'http://localhost:3000');
  }

  private get apiPublicUrl(): string {
    // Where DimePay's servers can reach ours to deliver a webhook --
    // distinct from WEB_APP_ORIGIN, which is the customer-facing site.
    return this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:4000/api',
    );
  }

  /** Minimal HS256 JWT signer -- avoids adding the `jsonwebtoken` package
   * for what DimePay's own examples show is just `jwt.sign(payload, secret)`
   * with default (HS256) settings. */
  private signJwt(payload: Record<string, unknown>, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');
    return `${signingInput}.${signature}`;
  }

  private async request(
    method: string,
    path: string,
    clientKey: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        client_key: clientKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  /**
   * Confirms a client_key/signingSecret pair is genuinely accepted by
   * DimePay before we mark a supplier's account CONNECTED -- without
   * creating a real order or charging anything. DimePay has no dedicated
   * "verify credentials" endpoint, so this signs a bogus, never-real
   * order token and reads GET /orders/{token}: a 404 means the key was
   * accepted (the fake order simply doesn't exist); a 401 means the key
   * itself was rejected.
   */
  async verifyCredentials(
    creds: DimePayCredentials,
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const bogusToken = this.signJwt(
        { token: `verify_${randomUUID()}` },
        creds.signingSecret,
      );
      const res = await this.request(
        'GET',
        `/orders/${bogusToken}`,
        creds.clientKey,
      );
      if (res.status === 401) {
        return { valid: false, reason: 'DimePay rejected the client key.' };
      }
      // 404 (order not found) is the expected, successful outcome here.
      // Anything else (network hiccup, 5xx) we don't treat as a hard
      // rejection -- a supplier shouldn't be blocked from saving their
      // credentials because DimePay's API had a bad moment.
      return { valid: true };
    } catch (err: unknown) {
      this.logger.warn(
        `DimePay credential check failed to complete: ${String(err)}`,
      );
      return { valid: true };
    }
  }

  /**
   * Creates a DimePay hosted checkout page for one supplier's order and
   * returns the URL to send the customer to. orderId is threaded through
   * as both `id` and `referenceTransactionId` in the signed payload so
   * the webhook (whatever shape its body turns out to be) and the
   * order-status lookup both have a reliable way back to our own Order.
   */
  async createHostedCheckout(
    creds: DimePayCredentials,
    input: CreateHostedCheckoutInput,
  ): Promise<string | null> {
    const payload = {
      webhookUrl: `${this.apiPublicUrl}/webhooks/dimepay`,
      redirectUrl: `${this.webAppOrigin}/orders/${input.orderId}?dimepay=return`,
      checkoutUrl: `${this.webAppOrigin}/checkout`,
      currency: input.currency,
      id: input.orderId,
      subtotal: input.total,
      total: input.total,
      email: input.customerEmail,
      referenceTransactionId: input.referenceTransactionId,
      items: input.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        sku: item.sku,
        quantity: item.quantity,
      })),
    };

    const signedData = this.signJwt(payload, creds.signingSecret);
    const res = await this.request(
      'POST',
      '/payments/hosted-page',
      creds.clientKey,
      {
        lang: 'en',
        data: signedData,
      },
    );

    if (!res.ok) {
      this.logger.warn(
        `DimePay hosted-page creation failed for order ${input.orderId}: ${res.status} ${JSON.stringify(res.data)}`,
      );
      return null;
    }

    const orderUrl = (res.data as { order_url?: string } | null)?.order_url;
    return orderUrl ?? null;
  }

  /**
   * DimePay's own order token isn't returned separately from the hosted
   * checkout response -- only the order_url is. The trailing path
   * segment of that URL (.../e-order/<token>) is DimePay's token, which
   * is what this expects as `token`.
   */
  async getOrderStatus(
    creds: DimePayCredentials,
    token: string,
  ): Promise<DimePayOrderStatus | null> {
    const signedToken = this.signJwt({ token }, creds.signingSecret);
    const res = await this.request(
      'GET',
      `/orders/${signedToken}`,
      creds.clientKey,
    );
    if (!res.ok) {
      this.logger.warn(
        `DimePay order status lookup failed for token ${token}: ${res.status}`,
      );
      return null;
    }
    const data = res.data as { status?: string } | null;
    if (!data?.status) return null;
    return { status: data.status, raw: data };
  }

  /** Extracts the token DimePay embeds at the end of an order_url. */
  static tokenFromOrderUrl(orderUrl: string): string | null {
    const match = /\/e-order\/([^/?#]+)/.exec(orderUrl);
    return match?.[1] ?? null;
  }
}
