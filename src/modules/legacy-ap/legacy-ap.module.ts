import { Module } from '@nestjs/common';
import { ApCodeGuard } from '../../common/guards/ap-code.guard';
import { LegacyJwtAdminGuard } from '../../common/guards/legacy-jwt-admin.guard';
import { LegacyJwtGuard } from '../../common/guards/legacy-jwt.guard';
import { LegacyDataService } from '../legacy-data/legacy-data.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LegacySitemapService } from '../legacy-sitemap/legacy-sitemap.service';
import {
  ArticleAdminController,
  CarDetailsAdminController,
  LegacyApPaymentsAdminController,
  MakeModelDataController,
  PostToolingController,
  RoleManagementController,
  SitemapAdminController,
  UserManagementController,
  VendorAdminController,
  VendorManagementController,
} from './legacy-ap-admin.controller';
import { LegacyApAuthController } from './legacy-ap-auth.controller';
import { LegacyApService } from './legacy-ap.service';

@Module({
  controllers: [
    LegacyApAuthController,
    RoleManagementController,
    UserManagementController,
    VendorAdminController,
    PostToolingController,
    VendorManagementController,
    CarDetailsAdminController,
    MakeModelDataController,
    ArticleAdminController,
    SitemapAdminController,
    LegacyApPaymentsAdminController,
  ],
  providers: [
    LegacyApService,
    LocalUserVendorService,
    LocalPostOrderService,
    LegacyDataService,
    LegacySitemapService,
    ApCodeGuard,
    LegacyJwtGuard,
    LegacyJwtAdminGuard,
  ],
})
export class LegacyApModule {}
