import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';

void ConfigModule.forRoot({
  isGlobal: true,
});

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,        // seconds
      limit: 10,      // max 10 requests per ttl
    })
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
