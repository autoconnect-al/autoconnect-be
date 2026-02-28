import { Injectable } from '@nestjs/common';
import { createLogger } from '../../common/logger.util';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentOrderCreateInput {
  orderReference: string;
  totalAmount: number;
  currencyCode: string;
}

export interface PaymentOrderCreateResult {
  id: string;
  status: string;
  links: Array<{
    rel: string;
    href: string;
    method: string;
  }>;
}

export interface PaymentOrderCaptureResult {
  id: string;
  status: string;
  amount?: number;
  currencyCode?: string;
  captureId?: string;
  payerEmail?: string;
  rawPayload?: unknown;
}

export interface PaymentProvider {
  createOrder(input: PaymentOrderCreateInput): Promise<PaymentOrderCreateResult>;
  captureOrder(
    orderId: string,
    captureRequestId?: string,
  ): Promise<PaymentOrderCaptureResult>;
  verifyWebhookSignature(input: {
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<boolean>;
}

@Injectable()
export class LocalPaymentProviderService implements PaymentProvider {
  async createOrder(
    input: PaymentOrderCreateInput,
  ): Promise<PaymentOrderCreateResult> {
    const id = `LOCAL-${input.orderReference}`;
    return {
      id,
      status: 'CREATED',
      links: [
        {
          rel: 'approve',
          href: `https://autoconnect.al/payments/mock/${id}`,
          method: 'GET',
        },
      ],
    };
  }

  async captureOrder(orderId: string): Promise<PaymentOrderCaptureResult> {
    return {
      id: orderId,
      status: 'COMPLETED',
    };
  }

  async verifyWebhookSignature(_input: {
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<boolean> {
    return true;
  }
}

type PayPalOrderResponse = {
  id?: unknown;
  status?: unknown;
  links?: Array<{
    rel?: unknown;
    href?: unknown;
    method?: unknown;
  }>;
};

@Injectable()
export class PayPalPaymentProviderService implements PaymentProvider {
  private readonly logger = createLogger('paypal-payment-provider');
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryMax: number;
  private readonly retryBaseDelayMs: number;

  constructor() {
    this.clientId = String(process.env.PAYPAL_CLIENT_ID ?? '').trim();
    this.clientSecret = String(process.env.PAYPAL_CLIENT_SECRET ?? '').trim();
    this.baseUrl = this.resolveBaseUrl();
    this.timeoutMs = this.readPositiveInt('PAYPAL_HTTP_TIMEOUT_MS', 10_000);
    this.retryMax = this.readPositiveInt('PAYPAL_HTTP_RETRY_MAX', 2);
    this.retryBaseDelayMs = this.readPositiveInt('PAYPAL_HTTP_RETRY_BASE_MS', 300);

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Missing PayPal credentials: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.',
      );
    }
  }

  async createOrder(
    input: PaymentOrderCreateInput,
  ): Promise<PaymentOrderCreateResult> {
    const accessToken = await this.getAccessToken();
    const response = await this.postJson<PayPalOrderResponse>(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.orderReference,
            custom_id: input.orderReference,
            amount: {
              currency_code: input.currencyCode,
              value: input.totalAmount.toFixed(2),
            },
          },
        ],
      },
      {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=representation',
        'PayPal-Request-Id': `create:${input.orderReference}`,
      },
    );

    return this.toOrderCreateResult(response);
  }

  async captureOrder(
    orderId: string,
    captureRequestId?: string,
  ): Promise<PaymentOrderCaptureResult> {
    const accessToken = await this.getAccessToken();
    const response = await this.postJson<PayPalOrderResponse>(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {},
      {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=representation',
        'PayPal-Request-Id': captureRequestId || `capture:${orderId}`,
      },
    );

    const id = this.toNonEmptyString(response.id);
    const status = this.toNonEmptyString(response.status);
    const capture = this.extractCapture(response);
    const captureAmount = this.toRecord(capture.amount);
    const amount = this.toNullableNumber(captureAmount.value);
    const currencyCode = this.toNonEmptyString(captureAmount.currency_code);
    const captureId = this.toNonEmptyString(capture.id);
    const payerEmail = this.toNonEmptyString(
      (response as Record<string, unknown>)?.payer &&
        typeof (response as Record<string, unknown>).payer === 'object'
        ? ((response as Record<string, unknown>).payer as Record<string, unknown>)
            .email_address
        : undefined,
    );
    if (!id || !status) {
      throw new Error('Invalid PayPal capture response payload.');
    }
    if (capture.status && this.toNonEmptyString(capture.status) !== 'COMPLETED') {
      throw new Error(
        `PayPal capture status is not COMPLETED: ${this.toNonEmptyString(capture.status)}`,
      );
    }
    if (!currencyCode || amount === null) {
      throw new Error(
        'PayPal capture response missing amount/currency for reconciliation.',
      );
    }

    return {
      id,
      status,
      amount,
      currencyCode,
      captureId: captureId || undefined,
      payerEmail: payerEmail || undefined,
      rawPayload: response,
    };
  }

  async verifyWebhookSignature(input: {
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<boolean> {
    const webhookId = this.toNonEmptyString(process.env.PAYPAL_WEBHOOK_ID);
    if (!webhookId) {
      this.logger.warn('paypal.webhook.verify.skipped', {
        reason: 'missing-webhook-id',
      });
      return false;
    }
    const transmissionId = this.toNonEmptyString(
      input.headers['paypal-transmission-id'],
    );
    const transmissionTime = this.toNonEmptyString(
      input.headers['paypal-transmission-time'],
    );
    const certUrl = this.toNonEmptyString(input.headers['paypal-cert-url']);
    const authAlgo = this.toNonEmptyString(input.headers['paypal-auth-algo']);
    const transmissionSig = this.toNonEmptyString(
      input.headers['paypal-transmission-sig'],
    );
    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      return false;
    }

    const accessToken = await this.getAccessToken();
    const response = await this.postJson<{ verification_status?: unknown }>(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: input.body,
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    return (
      this.toNonEmptyString(response.verification_status).toUpperCase() ===
      'SUCCESS'
    );
  }

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const body = await this.safeResponseBody(response);
      throw new Error(
        `PayPal OAuth failed with status ${response.status}: ${body}`,
      );
    }

    const payload = (await response.json()) as { access_token?: unknown };
    const token = this.toNonEmptyString(payload.access_token);
    if (!token) {
      throw new Error('PayPal OAuth response missing access_token.');
    }
    return token;
  }

  private async postJson<T>(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<T> {
    const startedAt = Date.now();
    for (let attempt = 0; attempt <= this.retryMax; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const responseBody = await this.safeResponseBody(response);
          const shouldRetry =
            response.status >= 500 || response.status === 429 || response.status === 408;
          if (shouldRetry && attempt < this.retryMax) {
            await this.delay(this.retryDelayMs(attempt));
            continue;
          }
          throw new Error(
            `PayPal request failed with status ${response.status}: ${responseBody}`,
          );
        }

        const durationMs = Date.now() - startedAt;
        this.logger.info('paypal.http.success', {
          path: this.stripBaseUrl(url),
          attempt: attempt + 1,
          durationMs,
        });
        return (await response.json()) as T;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const isLastAttempt = attempt >= this.retryMax;
        this.logger[isLastAttempt ? 'error' : 'warn']('paypal.http.error', {
          path: this.stripBaseUrl(url),
          attempt: attempt + 1,
          durationMs,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        });
        if (isLastAttempt) {
          throw error;
        }
        await this.delay(this.retryDelayMs(attempt));
      }
    }

    throw new Error('PayPal request retry exhaustion.');
  }

  private async safeResponseBody(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '<unreadable>';
    }
  }

  private toOrderCreateResult(
    payload: PayPalOrderResponse,
  ): PaymentOrderCreateResult {
    const id = this.toNonEmptyString(payload.id);
    const status = this.toNonEmptyString(payload.status);
    const linksRaw = Array.isArray(payload.links) ? payload.links : [];
    const links = linksRaw
      .map((link) => {
        const rel = this.toNonEmptyString(link.rel);
        const href = this.toNonEmptyString(link.href);
        const method = this.toNonEmptyString(link.method);
        if (!rel || !href || !method) {
          return null;
        }
        return { rel, href, method };
      })
      .filter((item): item is { rel: string; href: string; method: string } =>
        Boolean(item),
      );

    if (!id || !status || links.length === 0) {
      throw new Error('Invalid PayPal create order response payload.');
    }

    return { id, status, links };
  }

  private toNonEmptyString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableNumber(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private extractCapture(payload: PayPalOrderResponse): Record<string, unknown> {
    const root = payload as Record<string, unknown>;
    const purchaseUnits = Array.isArray(root.purchase_units)
      ? (root.purchase_units as Array<Record<string, unknown>>)
      : [];
    const firstUnit = purchaseUnits[0] ?? {};
    const payments =
      firstUnit && typeof firstUnit === 'object'
        ? (firstUnit.payments as Record<string, unknown> | undefined)
        : undefined;
    const captures = payments && Array.isArray(payments.captures)
      ? (payments.captures as Array<Record<string, unknown>>)
      : [];
    return captures[0] ?? {};
  }

  private retryDelayMs(attempt: number): number {
    return this.retryBaseDelayMs * Math.max(1, 2 ** attempt);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private readPositiveInt(name: string, fallback: number): number {
    const raw = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(raw) || raw <= 0) {
      return fallback;
    }
    return Math.floor(raw);
  }

  private stripBaseUrl(url: string): string {
    if (url.startsWith(this.baseUrl)) {
      return url.slice(this.baseUrl.length);
    }
    return url;
  }

  private resolveBaseUrl(): string {
    const explicit = String(process.env.PAYPAL_BASE_URL ?? '').trim();
    if (explicit) {
      return explicit;
    }
    const env = String(process.env.PAYPAL_ENV ?? 'sandbox')
      .trim()
      .toLowerCase();
    if (env === 'live' || env === 'production') {
      return 'https://api-m.paypal.com';
    }
    return 'https://api-m.sandbox.paypal.com';
  }
}

export function selectPaymentProvider(): PaymentProvider {
  const mode = String(process.env.PAYMENT_PROVIDER_MODE ?? '')
    .trim()
    .toLowerCase();

  if (mode === 'local') {
    return new LocalPaymentProviderService();
  }
  if (mode === 'paypal') {
    return new PayPalPaymentProviderService();
  }
  if (process.env.NODE_ENV === 'test') {
    return new LocalPaymentProviderService();
  }
  return new PayPalPaymentProviderService();
}
