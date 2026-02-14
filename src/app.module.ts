import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LegacyAuthModule } from './modules/legacy-auth/legacy-auth.module';
import { LegacySearchModule } from './modules/legacy-search/legacy-search.module';
import { LegacyDataModule } from './modules/legacy-data/legacy-data.module';
import { LegacyFavouritesModule } from './modules/legacy-favourites/legacy-favourites.module';
import { LegacyAdminModule } from './modules/legacy-admin/legacy-admin.module';
import { LegacySitemapModule } from './modules/legacy-sitemap/legacy-sitemap.module';
import { LegacyDocsModule } from './modules/legacy-docs/legacy-docs.module';
import { LegacyPaymentsModule } from './modules/legacy-payments/legacy-payments.module';
import { LegacyApModule } from './modules/legacy-ap/legacy-ap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LegacyAuthModule,
    LegacySearchModule,
    LegacyDataModule,
    LegacyFavouritesModule,
    LegacyAdminModule,
    LegacySitemapModule,
    LegacyDocsModule,
    LegacyPaymentsModule,
    LegacyApModule,
  ],
})
export class AppModule {}
