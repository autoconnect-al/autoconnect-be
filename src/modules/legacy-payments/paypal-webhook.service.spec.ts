import { HttpException } from '@nestjs/common';
import { PayPalWebhookService } from './paypal-webhook.service';

describe('PayPalWebhookService', () => {
  it('throws 400 when webhook signature verification fails', async () => {
    const prisma = {
      customer_orders: {
        updateMany: jest.fn(),
      },
    } as any;
    const paymentProvider = {
      verifyWebhookSignature: jest.fn().mockResolvedValue(false),
    } as any;
    const service = new PayPalWebhookService(prisma, paymentProvider);

    await expect(
      service.verifyAndProcess({}, { event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.customer_orders.updateMany).not.toHaveBeenCalled();
  });

  it('writes audit fields when verified webhook includes order id', async () => {
    const prisma = {
      customer_orders: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const paymentProvider = {
      verifyWebhookSignature: jest.fn().mockResolvedValue(true),
    } as any;
    const service = new PayPalWebhookService(prisma, paymentProvider);

    const response = await service.verifyAndProcess(
      {
        'paypal-transmission-id': 'abc',
      },
      {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-1',
          amount: { value: '9.99', currency_code: 'EUR' },
          payer: { email_address: 'payer@example.com' },
          supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
        },
      },
    );

    expect(response).toEqual({
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      orderId: 'ORDER-1',
      updated: true,
    });
    expect(prisma.customer_orders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paypalId: 'ORDER-1' },
        data: expect.objectContaining({
          paypalCaptureId: 'CAPTURE-1',
          paypalPayerEmail: 'payer@example.com',
          paypalOrderStatus: 'PAYMENT.CAPTURE.COMPLETED',
          capturedAmount: 9.99,
          capturedCurrency: 'EUR',
        }),
      }),
    );
  });
});
