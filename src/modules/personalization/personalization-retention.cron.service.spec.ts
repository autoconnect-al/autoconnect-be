import { PersonalizationRetentionCronService } from './personalization-retention.cron.service';

describe('PersonalizationRetentionCronService', () => {
  it('runs stale-term decay and cleanup jobs', async () => {
    const decayStaleTerms = jest.fn().mockResolvedValue({
      decayed: 3,
      deleted: 1,
    });
    const cleanupInactiveProfiles = jest.fn().mockResolvedValue(2);
    const service = new PersonalizationRetentionCronService({
      decayStaleTerms,
      cleanupInactiveProfiles,
    } as any);

    await expect(service.cleanupInactiveProfilesAtMidnight()).resolves.toBeUndefined();
    expect(decayStaleTerms).toHaveBeenCalledTimes(1);
    expect(cleanupInactiveProfiles).toHaveBeenCalledTimes(1);
  });
});
