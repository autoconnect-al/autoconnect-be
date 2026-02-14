import { Module } from '@nestjs/common';
import { LegacyDataController } from './legacy-data.controller';
import { LegacyDataService } from './legacy-data.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalMediaService } from './local-media.service';

@Module({
  controllers: [LegacyDataController],
  providers: [
    LegacyDataService,
    LocalPostOrderService,
    LocalUserVendorService,
    LocalMediaService,
  ],
})
export class LegacyDataModule {}
