import { Module } from '@nestjs/common';
import { ApCodeGuard } from '../../common/guards/ap-code.guard';
import { LegacyJwtAdminGuard } from '../../common/guards/legacy-jwt-admin.guard';
import { LegacyJwtGuard } from '../../common/guards/legacy-jwt.guard';
import { LegacyDataService } from '../legacy-data/legacy-data.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import {
  LocalPaymentProviderService,
  PAYMENT_PROVIDER,
} from '../legacy-payments/payment-provider';
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
import { ApMakeModelService } from './ap-make-model.service';
import { ApPaymentReminderService } from './ap-payment-reminder.service';
import { ApPostToolingService } from './ap-post-tooling.service';
import { ApPromptRepository } from './ap-prompt.repository';
import { ApPromptService } from './ap-prompt.service';
import { ApRoleService } from './ap-role.service';
import { ApSitemapAdminService } from './ap-sitemap-admin.service';
import { ApUserVendorService } from './ap-user-vendor.service';
import { ApVendorManagementService } from './ap-vendor-management.service';

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
    ApPostToolingService,
    ApPromptRepository,
    ApPromptService,
    ApArticleService,
    ApMakeModelService,
    ApSitemapAdminService,
    ApPaymentReminderService,
    ApVendorManagementService,
    ApRoleService,
    ApUserVendorService,
    LocalUserVendorService,
    LocalPostOrderService,
    { provide: PAYMENT_PROVIDER, useClass: LocalPaymentProviderService },
    LegacyDataService,
    LegacySitemapService,
    ApCodeGuard,
    LegacyJwtGuard,
    LegacyJwtAdminGuard,
  ],
})
export class LegacyApModule {}
