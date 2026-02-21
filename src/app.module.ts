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
import { IngestModule } from './modules/imports/apify-import.module';

function validateEnvironment(config: Record<string, unknown>) {
  const env = config as Record<string, string | undefined>;
  const isTest = env.NODE_ENV === 'test';

  if (isTest) {
    return config;
  }

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'AP_ADMIN_CODE',
    'ADMIN_CODE',
    'INSTAGRAM_CLIENT_ID',
    'INSTAGRAM_CLIENT_SECRET',
  ];

  const missing = required.filter((key) => {
    const value = env[key];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
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
    IngestModule,
  ],
})
export class AppModule {}
