import { Module } from '@nestjs/common';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { LegacyAuthController } from './legacy-auth.controller';
import { LegacyAuthService } from './legacy-auth.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: seconds(60),
        limit: 200,
      },
    ]),
  ],
  controllers: [LegacyAuthController],
  providers: [LegacyAuthService, LocalUserVendorService, AuthRateLimitGuard],
})
export class LegacyAuthModule {}
