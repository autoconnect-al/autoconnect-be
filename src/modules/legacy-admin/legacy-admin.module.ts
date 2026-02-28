import { Module } from '@nestjs/common';
import { LegacyAdminController } from './legacy-admin.controller';
import { LegacyAdminService } from './legacy-admin.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LegacyJwtGuard } from '../../common/guards/legacy-jwt.guard';
import { LegacyJwtAdminGuard } from '../../common/guards/legacy-jwt-admin.guard';
import {
  LocalPaymentProviderService,
  PAYMENT_PROVIDER,
} from '../legacy-payments/payment-provider';

@Module({
  controllers: [LegacyAdminController],
  providers: [
    LegacyAdminService,
    LocalUserVendorService,
    LocalPostOrderService,
    { provide: PAYMENT_PROVIDER, useClass: LocalPaymentProviderService },
    LegacyJwtGuard,
    LegacyJwtAdminGuard,
  ],
})
export class LegacyAdminModule {}
