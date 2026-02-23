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
import { ApArticleService } from './ap-article.service';
import { ApPostToolingService } from './ap-post-tooling.service';
import { ApPromptRepository } from './ap-prompt.repository';
import { ApPromptService } from './ap-prompt.service';
import { ApRoleService } from './ap-role.service';
import { ApUserVendorService } from './ap-user-vendor.service';
import { LegacyApService } from './legacy-ap.service';

@Module({
  controllers: [
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
    ApPostToolingService,
    ApPromptRepository,
    ApPromptService,
    ApArticleService,
    ApRoleService,
    ApUserVendorService,
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
