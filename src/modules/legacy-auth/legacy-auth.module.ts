import { Module } from '@nestjs/common';
import { LegacyAuthController } from './legacy-auth.controller';
import { LegacyAuthService } from './legacy-auth.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';

@Module({
  controllers: [LegacyAuthController],
  providers: [LegacyAuthService, LocalUserVendorService],
})
export class LegacyAuthModule {}
