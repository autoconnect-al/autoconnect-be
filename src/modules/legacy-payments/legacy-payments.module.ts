import { Module } from '@nestjs/common';
import { LegacyPaymentsController } from './legacy-payments.controller';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';

@Module({
  controllers: [LegacyPaymentsController],
  providers: [LocalPostOrderService, LocalUserVendorService],
})
export class LegacyPaymentsModule {}
