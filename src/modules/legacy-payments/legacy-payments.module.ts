import { Module } from '@nestjs/common';
import { LegacyPaymentsController } from './legacy-payments.controller';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import {
  LocalPaymentProviderService,
  PAYMENT_PROVIDER,
} from './payment-provider';

@Module({
  controllers: [LegacyPaymentsController],
  providers: [
    LocalPostOrderService,
    LocalUserVendorService,
    { provide: PAYMENT_PROVIDER, useClass: LocalPaymentProviderService },
  ],
})
export class LegacyPaymentsModule {}
