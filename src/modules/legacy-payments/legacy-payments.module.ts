import { Module } from '@nestjs/common';
import { LegacyPaymentsController } from './legacy-payments.controller';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import {
  PAYMENT_PROVIDER,
  selectPaymentProvider,
} from './payment-provider';
import { PayPalWebhookService } from './paypal-webhook.service';

@Module({
  controllers: [LegacyPaymentsController],
  providers: [
    LocalPostOrderService,
    LocalUserVendorService,
    PayPalWebhookService,
    { provide: PAYMENT_PROVIDER, useFactory: selectPaymentProvider },
  ],
})
export class LegacyPaymentsModule {}
