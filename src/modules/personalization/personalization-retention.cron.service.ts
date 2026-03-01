import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createLogger } from '../../common/logger.util';
import { PersonalizationService } from './personalization.service';

@Injectable()
export class PersonalizationRetentionCronService {
  private readonly logger = createLogger('personalization-retention-cron-service');

  constructor(private readonly personalizationService: PersonalizationService) {}

  @Cron('0 0 * * *')
  async cleanupInactiveProfilesAtMidnight(): Promise<void> {
    try {
      const deleted = await this.personalizationService.cleanupInactiveProfiles();
      this.logger.info('cron.personalization-retention.completed', { deleted });
    } catch (error) {
      this.logger.error('cron.personalization-retention.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
