import { PersonalizationService } from './personalization.service';

describe('PersonalizationService', () => {
  const originalEnabled = process.env.PERSONALIZATION_ENABLED;
  const originalRetention = process.env.PERSONALIZATION_RETENTION_DAYS;
  const originalStaleDays = process.env.PERSONALIZATION_STALE_TERM_DAYS;
  const originalStaleDecay = process.env.PERSONALIZATION_STALE_TERM_DECAY;

  afterEach(() => {
    process.env.PERSONALIZATION_ENABLED = originalEnabled;
    process.env.PERSONALIZATION_RETENTION_DAYS = originalRetention;
    process.env.PERSONALIZATION_STALE_TERM_DAYS = originalStaleDays;
    process.env.PERSONALIZATION_STALE_TERM_DECAY = originalStaleDecay;
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

  it('returns top terms with counters and timestamps when enabled', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        termKey: 'model',
        termValue: 'Q5',
        score: 14.2,
        searchCount: 3,
        openCount: 4,
        contactCount: 1,
        impressionCount: 6,
        dateUpdated: '2026-03-01T10:00:00.000Z',
        lastEventAt: '2026-03-01T11:00:00.000Z',
      },
    ]);

    const result = await service.getTopTerms('visitor-1');

    expect(result).toEqual([
      expect.objectContaining({
        termKey: 'model',
        termValue: 'Q5',
        score: 14.2,
        searchCount: 3,
        openCount: 4,
        contactCount: 1,
        impressionCount: 6,
      }),
    ]);
    expect(result[0]?.dateUpdated).toBeInstanceOf(Date);
    expect(result[0]?.lastEventAt).toBeInstanceOf(Date);
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
    const upsertCall = prisma.$executeRawUnsafe.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes('INSERT INTO visitor_interest_term'),
    ) as unknown[];
    expect(upsertCall?.[0]).toContain(
      'search_count = search_count + VALUES(search_count)',
    );
    expect(upsertCall.slice(5, 9)).toEqual([1, 0, 0, 0]);
  });

  it('records canonical price range term from search filters', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await service.recordSearchSignal({
      visitorId: 'visitor-price',
      type: 'car',
      searchTerms: [
        { key: 'price', value: { from: '10000', to: '18000' } },
      ],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
    });

    const priceUpsertCall = prisma.$executeRawUnsafe.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes('INSERT INTO visitor_interest_term')
        && call[2] === 'price',
    ) as unknown[] | undefined;
    expect(priceUpsertCall).toBeDefined();
    expect(priceUpsertCall?.[3]).toBe('10000:18000');
  });

  it('records canonical price range without discussable zero boundary', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await service.recordSearchSignal({
      visitorId: 'visitor-price-zero',
      type: 'car',
      searchTerms: [{ key: 'price', value: { from: '0', to: '18000' } }],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
    });

    const priceUpsertCall = prisma.$executeRawUnsafe.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes('INSERT INTO visitor_interest_term')
        && call[2] === 'price',
    ) as unknown[] | undefined;
    expect(priceUpsertCall).toBeDefined();
    expect(priceUpsertCall?.[3]).toBe(':18000');
  });

  it('records open post signal with open counter increment', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        make: 'Mercedes-benz',
        model: 'GLC',
        bodyType: 'SUV/Off-Road/Pick-up',
        fuelType: 'diesel',
        transmission: 'automatic',
        type: 'car',
      },
    ]);

    await service.recordPostSignalByPostId(10n, 'visitor-2', 'open');

    const upsertCall = prisma.$executeRawUnsafe.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes('INSERT INTO visitor_interest_term'),
    ) as unknown[];
    expect(upsertCall?.[0]).toContain('open_count = open_count + VALUES(open_count)');
    expect(upsertCall.slice(5, 9)).toEqual([0, 1, 0, 0]);
  });

  it('records exact price range from post signals', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        make: 'Mercedes-benz',
        model: 'GLC',
        bodyType: 'SUV/Off-Road/Pick-up',
        fuelType: 'diesel',
        transmission: 'automatic',
        type: 'car',
        price: 20500,
      },
    ]);

    await service.recordPostSignalByPostId(10n, 'visitor-2', 'open');

    const priceUpsertCall = prisma.$executeRawUnsafe.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes('INSERT INTO visitor_interest_term')
        && call[2] === 'price',
    ) as unknown[] | undefined;
    expect(priceUpsertCall).toBeDefined();
    expect(priceUpsertCall?.[3]).toBe('20500:20500');
  });

  it('does not record discussable zero price from post signals', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        make: 'Mercedes-benz',
        model: 'GLC',
        bodyType: 'SUV/Off-Road/Pick-up',
        fuelType: 'diesel',
        transmission: 'automatic',
        type: 'car',
        price: 0,
      },
    ]);

    await service.recordPostSignalByPostId(10n, 'visitor-2', 'open');

    const priceUpsertCall = prisma.$executeRawUnsafe.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes('INSERT INTO visitor_interest_term')
        && call[2] === 'price',
    ) as unknown[] | undefined;
    expect(priceUpsertCall).toBeUndefined();
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

  it('decays stale term scores and deletes non-positive rows', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    delete process.env.PERSONALIZATION_STALE_TERM_DAYS;
    delete process.env.PERSONALIZATION_STALE_TERM_DECAY;
    const { service, prisma } = makeService();
    prisma.$executeRawUnsafe
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);

    await expect(service.decayStaleTerms()).resolves.toEqual({
      decayed: 4,
      deleted: 2,
    });

    const updateSql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    const deleteSql = prisma.$executeRawUnsafe.mock.calls[1][0] as string;
    expect(updateSql).toContain('UPDATE visitor_interest_term');
    expect(updateSql).toContain('INTERVAL 2 DAY');
    expect(prisma.$executeRawUnsafe.mock.calls[0][1]).toBe(10);
    expect(deleteSql).toContain('DELETE FROM visitor_interest_term');
  });
});
