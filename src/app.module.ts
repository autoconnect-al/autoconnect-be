import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { SearchModule } from './modules/search/search.module';
import { IngestModule } from './modules/imports/apify-import.module';
import { DatabaseModule } from './database/database.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { BulkImportModule } from './modules/bulk-import/bulk-import.module';

void ConfigModule.forRoot({
  isGlobal: true,
});

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60, // seconds
          limit: 10, // max 10 requests per ttl
        },
      ],
    }),
    AuthModule,
    SearchModule,
    IngestModule,
    DatabaseModule,
    VendorModule,
    BulkImportModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
