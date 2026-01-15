import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './modules/auth/auth.controller';
import { SearchController } from './modules/search/search.controller';

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
  ],
  controllers: [
    AppController,
    HealthController,
    AuthController,
    SearchController,
  ],
  providers: [AppService],
})
export class AppModule {}
