import { PersonalizationRetentionCronService } from './personalization-retention.cron.service';

describe('PersonalizationRetentionCronService', () => {
  it('runs cleanup job', async () => {
    const cleanupInactiveProfiles = jest.fn().mockResolvedValue(2);
    const service = new PersonalizationRetentionCronService({
      cleanupInactiveProfiles,
    } as any);

    await expect(service.cleanupInactiveProfilesAtMidnight()).resolves.toBeUndefined();
    expect(cleanupInactiveProfiles).toHaveBeenCalledTimes(1);
  });
});
