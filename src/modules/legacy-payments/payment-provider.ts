import { Injectable } from '@nestjs/common';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentOrderCreateInput {
  orderReference: string;
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
  captureOrder(orderId: string): Promise<PaymentOrderCaptureResult>;
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
