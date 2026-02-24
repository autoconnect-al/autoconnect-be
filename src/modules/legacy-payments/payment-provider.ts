import { Injectable } from '@nestjs/common';

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
}

export interface PaymentProvider {
  createOrder(input: PaymentOrderCreateInput): Promise<PaymentOrderCreateResult>;
  captureOrder(
    orderId: string,
    captureRequestId?: string,
  ): Promise<PaymentOrderCaptureResult>;
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
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = String(process.env.PAYPAL_CLIENT_ID ?? '').trim();
    this.clientSecret = String(process.env.PAYPAL_CLIENT_SECRET ?? '').trim();
    this.baseUrl = this.resolveBaseUrl();

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
    if (!id || !status) {
      throw new Error('Invalid PayPal capture response payload.');
    }

    return { id, status };
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await this.safeResponseBody(response);
      throw new Error(
        `PayPal request failed with status ${response.status}: ${responseBody}`,
      );
    }

    return (await response.json()) as T;
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
