import { PersonalizationService } from './personalization.service';

describe('PersonalizationService', () => {
  const originalEnabled = process.env.PERSONALIZATION_ENABLED;
  const originalRetention = process.env.PERSONALIZATION_RETENTION_DAYS;

  afterEach(() => {
    process.env.PERSONALIZATION_ENABLED = originalEnabled;
    process.env.PERSONALIZATION_RETENTION_DAYS = originalRetention;
  });

  function makeService() {
    const prisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    } as any;

    return {
      service: new PersonalizationService(prisma),
      prisma,
    };
  }

  it('returns empty top terms when feature is disabled', async () => {
    process.env.PERSONALIZATION_ENABLED = 'false';
    const { service } = makeService();

    await expect(service.getTopTerms('visitor-1')).resolves.toEqual([]);
  });

  it('records search terms by touching profile and writing weighted terms', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();

    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await service.recordSearchSignal({
      visitorId: 'visitor-1',
      type: 'car',
      searchTerms: [
        { key: 'make1', value: 'BMW' },
        { key: 'model1', value: 'X5' },
      ],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    const firstCall = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(firstCall).toContain('INSERT INTO visitor_profile');
  });

  it('returns false on reset for invalid visitor id', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service } = makeService();

    await expect(service.resetVisitorProfile('   ')).resolves.toBe(false);
  });

  it('deletes profile on reset for valid visitor id', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await expect(service.resetVisitorProfile('visitor-2')).resolves.toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'DELETE FROM visitor_profile WHERE visitor_hash = ?',
      expect.any(String),
    );
  });

  it('cleans up inactive profiles with default retention', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    delete process.env.PERSONALIZATION_RETENTION_DAYS;
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(3);

    await expect(service.cleanupInactiveProfiles()).resolves.toBe(3);
    const sql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('INTERVAL 90 DAY');
  });
});
