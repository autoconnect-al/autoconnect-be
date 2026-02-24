import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createLogger } from '../../common/logger.util';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
import { Inject } from '@nestjs/common';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class PayPalWebhookService {
  private readonly logger = createLogger('paypal-webhook-service');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async verifyAndProcess(
    headers: Record<string, string | undefined>,
    body: unknown,
  ): Promise<{ eventType: string; orderId: string | null; updated: boolean }> {
    const verified = await this.paymentProvider.verifyWebhookSignature({
      headers,
      body,
    });
    if (!verified) {
      throw new HttpException(
        {
          success: false,
          statusCode: '400',
          message: 'Invalid PayPal webhook signature',
        },
        400,
      );
    }

    const payload = this.toRecord(body);
    const eventType = this.toSafeString(payload.event_type) || 'UNKNOWN';
    const resource = this.toRecord(payload.resource);
    const orderId = this.extractOrderId(resource);
    const captureId = this.toSafeString(resource.id) || null;
    const amountRecord = this.toRecord(resource.amount);
    const capturedAmount = this.toNullableNumber(amountRecord.value);
    const capturedCurrency = this.toSafeString(amountRecord.currency_code) || null;
    const payerEmail =
      this.toSafeString(this.toRecord(resource.payer).email_address) || null;

    if (!orderId) {
      this.logger.warn('paypal.webhook.missing_order_id', { eventType });
      return { eventType, orderId: null, updated: false };
    }

    const updateResult = await this.prisma.customer_orders.updateMany({
      where: { paypalId: orderId },
      data: {
        dateUpdated: new Date(),
        paypalCaptureId: captureId,
        paypalPayerEmail: payerEmail,
        paypalOrderStatus: eventType,
        paypalCapturePayload: this.toJsonString(payload),
        capturedAmount,
        capturedCurrency,
      } as any,
    } as any);

    this.logger.info('paypal.webhook.processed', {
      eventType,
      orderId,
      updatedRows: updateResult.count,
    });

    return { eventType, orderId, updated: updateResult.count > 0 };
  }

  private toRecord(value: unknown): AnyRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as AnyRecord;
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toJsonString(value: unknown): string | null {
    try {
      const text = JSON.stringify(value);
      return text && text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  private extractOrderId(resource: AnyRecord): string | null {
    const supplementaryData = this.toRecord(resource.supplementary_data);
    const relatedIds = this.toRecord(supplementaryData.related_ids);
    const fromRelated = this.toSafeString(relatedIds.order_id);
    if (fromRelated) {
      return fromRelated;
    }

    const purchaseUnits = Array.isArray(resource.purchase_units)
      ? (resource.purchase_units as unknown[])
      : [];
    const firstUnit = this.toRecord(purchaseUnits[0]);
    const fromReference = this.toSafeString(firstUnit.reference_id);
    if (fromReference) {
      return fromReference;
    }

    return null;
  }
}
