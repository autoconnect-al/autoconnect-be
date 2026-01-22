import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './modules/auth/auth.controller';
import { SearchController } from './modules/search/search.controller';
import { AuthModule } from './modules/auth/auth.module';
import { SearchModule } from './modules/search/search.module';

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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
