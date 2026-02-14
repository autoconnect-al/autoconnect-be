import { Module } from '@nestjs/common';
import { LegacyAdminController } from './legacy-admin.controller';
import { LegacyAdminService } from './legacy-admin.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';

@Module({
  controllers: [LegacyAdminController],
  providers: [
    LegacyAdminService,
    LocalUserVendorService,
    LocalPostOrderService,
  ],
})
export class LegacyAdminModule {}
