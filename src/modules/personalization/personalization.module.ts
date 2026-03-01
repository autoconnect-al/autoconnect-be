import { Global, Module } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import { PersonalizationController } from './personalization.controller';
import { PersonalizationRetentionCronService } from './personalization-retention.cron.service';

@Global()
@Module({
  controllers: [PersonalizationController],
  providers: [PersonalizationService, PersonalizationRetentionCronService],
  exports: [PersonalizationService],
})
export class PersonalizationModule {}
