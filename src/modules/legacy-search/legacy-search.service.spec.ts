import { LegacySearchService } from './legacy-search.service';
import { LegacySearchQueryBuilder } from './legacy-search-query-builder';

describe('LegacySearchService', () => {
  const trackedPersonalizationEnv = [
    'PERSONALIZATION_MAX_PERSONALIZED_SHARE',
    'PERSONALIZATION_MODEL_MAX_SHARE',
    'PERSONALIZATION_MAKE_MAX_SHARE',
    'PERSONALIZATION_MODEL_OPEN_THRESHOLD',
    'PERSONALIZATION_MAKE_OPEN_THRESHOLD',
    'PERSONALIZATION_BODYTYPE_OPEN_THRESHOLD',
    'PERSONALIZATION_GENERIC_OPEN_THRESHOLD',
    'PERSONALIZATION_CONTACT_THRESHOLD',
    'PERSONALIZATION_SEARCH_CANDIDATE_MULTIPLIER',
    'PERSONALIZATION_SEARCH_CANDIDATE_MAX',
    'PERSONALIZATION_MOST_WANTED_CANDIDATES',
  ] as const;
  const originalPersonalizationEnv = trackedPersonalizationEnv.reduce(
    (acc, key) => {
      acc[key] = process.env[key];
      return acc;
    },
    {} as Record<(typeof trackedPersonalizationEnv)[number], string | undefined>,
  );

  beforeEach(() => {
    for (const key of trackedPersonalizationEnv) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of trackedPersonalizationEnv) {
      const value = originalPersonalizationEnv[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('buildWhere should apply keyword korea clause', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'korea',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '(cleanedCaption LIKE ? OR accountName LIKE ?)',
    );
    expect(built.params).toEqual(
      expect.arrayContaining(['%korea%', '%korea%']),
    );
  });

  it('buildWhere should apply okazion,oferte pricing formula', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'okazion,oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
    expect(built.whereSql).toContain('minPrice > 1');
    expect(built.whereSql).toContain('maxPrice > 1');
  });

  it('buildWhere should apply pricing formula for keyword okazion', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'okazion',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
  });

  it('buildWhere should apply pricing formula for keyword oferte', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
  });

  it('buildWhere should normalize generalSearch tokens', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      generalSearch: 'Benc Seria 5',
      searchTerms: [],
    });

    expect(built.params).toEqual(expect.arrayContaining(['%benz%']));
    expect(built.whereSql).toContain('cleanedCaption LIKE ?');
  });

  it('buildWhere should support vendorAccountName active listing filter', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      searchTerms: [{ key: 'vendorAccountName', value: 'autokorea.al' }],
    });

    expect(built.whereSql).toContain('accountName = ?');
    expect(built.whereSql).not.toContain('vendorId != 1');
    expect(built.params).toEqual(expect.arrayContaining(['autokorea.al']));
  });

  it('buildWhere should apply customsPaid=true as true-or-null', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      searchTerms: [{ key: 'customsPaid', value: '1' }],
    });

    expect(built.whereSql).toContain(
      '(customsPaid = 1 OR customsPaid IS NULL)',
    );
  });

  it('should treat type-only search term as default for personalization gating', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-1'),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const filter = {
      type: 'car',
      searchTerms: [{ key: 'type', value: 'car' }],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
      visitorId: 'visitor-1',
    };

    expect((service as any).hasActiveSearchTerms(filter)).toBe(false);
    expect((service as any).shouldApplySearchPersonalization(filter)).toBe(true);
  });

  it('search should prepend matched promoted row and annotate promoted/highlighted', async () => {
    const now = Math.floor(Date.now() / 1000);
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 9,
            make: 'BMW',
            model: 'X5',
            promotionTo: now + 5000,
            highlightedTo: now + 100,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 9,
            make: 'BMW',
            model: 'X5',
            highlightedTo: now + 100,
          },
          {
            id: 10,
            make: 'BMW',
            model: 'X3',
            highlightedTo: now - 100,
          },
        ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'make1', value: 'BMW' }],
        sortTerms: [{ key: 'price', order: 'ASC' }],
        page: 0,
        maxResults: 10,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result).toHaveLength(2);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: 9,
        promoted: true,
        highlighted: true,
      }),
    );
    expect(response.result[1]).toEqual(
      expect.objectContaining({
        id: 10,
        promoted: false,
        highlighted: false,
      }),
    );
  });

  it('search should fallback to global promoted when filter-match is unavailable', async () => {
    const now = Math.floor(Date.now() / 1000);
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 77,
            make: 'Audi',
            model: 'A6',
            promotionTo: now + 5000,
            highlightedTo: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 11, make: 'BMW', model: 'X5' }]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'make1', value: 'BMW' }],
        page: 0,
        maxResults: 10,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: 77,
        promoted: true,
        highlighted: false,
      }),
    );
  });

  it('search should map variant-only models to variant LIKE filters', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ Model: 'X5', isVariant: 1 }])
        .mockResolvedValueOnce([
          {
            id: 11,
            make: 'BMW',
            model: '5 Series',
            variant: 'X5 M Sport',
          },
        ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [
          { key: 'make1', value: 'BMW' },
          { key: 'model1', value: 'X5' },
        ],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        page: 0,
        maxResults: 10,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result).toHaveLength(1);

    const searchCall = prisma.$queryRawUnsafe.mock.calls.find(
      (args: unknown[]) =>
        String(args[0]).includes('SELECT * FROM search') &&
        String(args[0]).includes('LIMIT ? OFFSET ?'),
    ) as unknown[] | undefined;

    expect(String(searchCall?.[0])).toContain(
      '(variant LIKE ? OR variant LIKE ? OR variant LIKE ?)',
    );
    expect(searchCall?.slice(1)).toEqual(
      expect.arrayContaining(['BMW', '% X5 %', 'X5%', '%X5']),
    );
  });

  it('search should enrich result rows with post stats and exclude postOpen', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 11,
            make: 'BMW',
            model: 'X5',
          },
        ]),
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11n,
            impressions: 100,
            reach: 80,
            clicks: 25,
            contact: 9,
            contactCall: 4,
            contactWhatsapp: 3,
            contactEmail: 1,
            contactInstagram: 1,
          },
        ]),
      },
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        page: 0,
        maxResults: 10,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: 11,
        impressions: 100,
        reach: 80,
        clicks: 25,
        contactCount: 9,
        contactCall: 4,
        contactWhatsapp: 3,
        contactEmail: 1,
        contactInstagram: 1,
      }),
    );
    expect(response.result[0]).not.toHaveProperty('postOpen');
  });

  it('search should enforce personalized slot caps without overwhelming the page', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 1, make: 'Audi', model: 'Q5', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 200 },
          { id: 2, make: 'BMW', model: 'X3', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 199 },
          { id: 3, make: 'Volkswagen', model: 'Tiguan', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 198 },
          { id: 4, make: 'Toyota', model: 'RAV4', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 197 },
          { id: 5, make: 'Kia', model: 'Sportage', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 196 },
          { id: 6, make: 'Peugeot', model: '3008', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 195 },
          { id: 7, make: 'Mercedes-benz', model: 'GLC', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 194 },
          { id: 8, make: 'Mercedes-benz', model: 'GLC', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 193 },
          { id: 9, make: 'Mercedes-benz', model: 'GLC', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 192 },
          { id: 10, make: 'Mercedes-benz', model: 'C-Class', bodyType: 'Sedans', renewedTime: 191 },
          { id: 11, make: 'Ford', model: 'Kuga', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 190 },
          { id: 12, make: 'Hyundai', model: 'Tucson', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 189 },
        ]),
    } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-1'),
      getTopTerms: jest.fn().mockResolvedValue([
        {
          termKey: 'model',
          termValue: 'GLC',
          score: 220,
          openCount: 9,
          contactCount: 1,
          searchCount: 2,
          impressionCount: 3,
        },
        {
          termKey: 'make',
          termValue: 'Mercedes-benz',
          score: 160,
          openCount: 8,
          contactCount: 1,
          searchCount: 2,
          impressionCount: 3,
        },
      ]),
      recordSearchSignal: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'type', value: 'car' }],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        visitorId: 'visitor-1',
        page: 0,
        maxResults: 10,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result).toHaveLength(10);
    const glcRows = response.result.filter(
      (row: { model: string }) => row.model.toLowerCase() === 'glc',
    );
    const mercedesRows = response.result.filter(
      (row: { make: string }) => row.make.toLowerCase() === 'mercedes-benz',
    );
    expect(glcRows.length).toBeLessThanOrEqual(3);
    expect(mercedesRows.length).toBeLessThanOrEqual(4);

    const searchCall = prisma.$queryRawUnsafe.mock.calls[1];
    expect(searchCall[searchCall.length - 2]).toBe(50);
    expect(searchCall[searchCall.length - 1]).toBe(0);
  });

  it('search should ignore low-confidence terms below open threshold', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 1, make: 'Audi', model: 'Q5', renewedTime: 100 },
          { id: 2, make: 'BMW', model: 'X3', renewedTime: 99 },
          { id: 3, make: 'Mercedes-benz', model: 'GLC', renewedTime: 98 },
          { id: 4, make: 'Mercedes-benz', model: 'GLC', renewedTime: 97 },
        ]),
    } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-2'),
      getTopTerms: jest.fn().mockResolvedValue([
        {
          termKey: 'model',
          termValue: 'GLC',
          score: 500,
          openCount: 1,
          contactCount: 0,
          searchCount: 1,
          impressionCount: 0,
        },
      ]),
      recordSearchSignal: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'type', value: 'car' }],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        visitorId: 'visitor-2',
        page: 0,
        maxResults: 4,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result.map((row: { id: number }) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it('search should activate model personalization after open threshold', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 1, make: 'Audi', model: 'Q5', renewedTime: 100 },
          { id: 2, make: 'BMW', model: 'X3', renewedTime: 99 },
          { id: 3, make: 'Mercedes-benz', model: 'GLC', renewedTime: 98 },
          { id: 4, make: 'Toyota', model: 'RAV4', renewedTime: 97 },
          { id: 5, make: 'Volkswagen', model: 'Tiguan', renewedTime: 96 },
          { id: 6, make: 'Kia', model: 'Sportage', renewedTime: 95 },
        ]),
    } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-3'),
      getTopTerms: jest.fn().mockResolvedValue([
        {
          termKey: 'model',
          termValue: 'GLC',
          score: 500,
          openCount: 3,
          contactCount: 0,
          searchCount: 1,
          impressionCount: 0,
        },
      ]),
      recordSearchSignal: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'type', value: 'car' }],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        visitorId: 'visitor-3',
        page: 0,
        maxResults: 6,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.result[0]).toEqual(expect.objectContaining({ model: 'GLC' }));
  });

  it('search should elevate shared bodyType intent across multiple opened models', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 1, make: 'Audi', model: 'Q5', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 100 },
          { id: 2, make: 'BMW', model: 'X3', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 99 },
          { id: 3, make: 'Mercedes-benz', model: 'GLC', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 98 },
          { id: 4, make: 'Volkswagen', model: 'Tiguan', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 97 },
          { id: 5, make: 'Toyota', model: 'RAV4', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 96 },
          { id: 6, make: 'Honda', model: 'CR-V', bodyType: 'SUV/Off-Road/Pick-up', renewedTime: 95 },
          { id: 7, make: 'Mercedes-benz', model: 'C-Class', bodyType: 'Sedans', renewedTime: 94 },
          { id: 8, make: 'BMW', model: '3 Series', bodyType: 'Sedans', renewedTime: 93 },
          { id: 9, make: 'Audi', model: 'A4', bodyType: 'Sedans', renewedTime: 92 },
          { id: 10, make: 'Skoda', model: 'Octavia', bodyType: 'Sedans', renewedTime: 91 },
        ]),
    } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-4'),
      getTopTerms: jest.fn().mockResolvedValue([
        { termKey: 'model', termValue: 'Q5', score: 90, openCount: 4, contactCount: 0 },
        { termKey: 'model', termValue: 'X3', score: 85, openCount: 4, contactCount: 0 },
        { termKey: 'model', termValue: 'GLC', score: 80, openCount: 4, contactCount: 0 },
        {
          termKey: 'bodyType',
          termValue: 'SUV/Off-Road/Pick-up',
          score: 100,
          openCount: 5,
          contactCount: 0,
        },
      ]),
      recordSearchSignal: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const response = await service.search(
      JSON.stringify({
        type: 'car',
        searchTerms: [{ key: 'type', value: 'car' }],
        sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
        visitorId: 'visitor-4',
        page: 0,
        maxResults: 8,
      }),
    );

    expect(response.success).toBe(true);
    const suvCount = response.result.filter(
      (row: { bodyType: string }) =>
        row.bodyType.toLowerCase() === 'suv/off-road/pick-up',
    ).length;
    expect(suvCount).toBeGreaterThanOrEqual(5);
  });

  it('relatedById should select sidecarMedias for related cards', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;

    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());
    await service.relatedById('1', 'car');

    const relatedQueryCall = prisma.$queryRawUnsafe.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes('ORDER BY dateUpdated DESC, id DESC LIMIT ?'),
    );
    expect(relatedQueryCall).toBeTruthy();
    const query = relatedQueryCall?.[0] as string;
    expect(query).toContain('sidecarMedias');
    expect(query).toContain('profilePicture');
    expect(query).toContain('promotionTo');
    expect(query).toContain('renewInterval');
  });

  it('relatedById should include car_detail object in response rows', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 2,
            make: 'BMW',
            model: 'X5',
            price: 12000,
            customsPaid: 1,
          },
        ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.relatedById('1', 'car');
    const first = (response.result as Array<Record<string, unknown>>)[0];
    expect(first.car_detail).toMatchObject({
      make: 'BMW',
      model: 'X5',
      price: 12000,
      customsPaid: 1,
    });
    expect(first.promoted).toBe(false);
  });

  it('mostWanted should include car_detail object in response rows', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 2,
          make: 'Audi',
          model: 'A6',
          price: 20000,
          customsPaid: 0,
        },
      ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.mostWanted();
    const first = (response.result as Array<Record<string, unknown>>)[0];
    expect(first.car_detail).toMatchObject({
      make: 'Audi',
      model: 'A6',
      price: 20000,
      customsPaid: 0,
    });
  });

  it('mostWanted should apply personalization caps and return mixed results', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { id: 1, make: 'Mercedes-benz', model: 'GLC', renewedTime: 100, mostWantedTo: 1000 },
        { id: 2, make: 'Mercedes-benz', model: 'GLC', renewedTime: 99, mostWantedTo: 999 },
        { id: 3, make: 'Mercedes-benz', model: 'GLC', renewedTime: 98, mostWantedTo: 998 },
        { id: 4, make: 'Audi', model: 'Q5', renewedTime: 97, mostWantedTo: 997 },
        { id: 5, make: 'BMW', model: 'X3', renewedTime: 96, mostWantedTo: 996 },
        { id: 6, make: 'Volkswagen', model: 'Tiguan', renewedTime: 95, mostWantedTo: 995 },
      ]),
    } as any;
    const personalizationService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isPersonalizationDisabled: jest.fn().mockReturnValue(false),
      sanitizeVisitorId: jest.fn().mockReturnValue('visitor-5'),
      getTopTerms: jest.fn().mockResolvedValue([
        {
          termKey: 'model',
          termValue: 'GLC',
          score: 200,
          openCount: 6,
          contactCount: 0,
          searchCount: 1,
          impressionCount: 0,
        },
        {
          termKey: 'make',
          termValue: 'Mercedes-benz',
          score: 170,
          openCount: 5,
          contactCount: 0,
          searchCount: 1,
          impressionCount: 0,
        },
      ]),
    } as any;
    const service = new LegacySearchService(
      prisma,
      new LegacySearchQueryBuilder(),
      personalizationService,
    );

    const response = await service.mostWanted(
      undefined,
      undefined,
      'visitor-5',
      false,
    );

    expect(response.success).toBe(true);
    expect(response.result).toHaveLength(4);
    const glcRows = response.result.filter(
      (row: { model: string }) => row.model.toLowerCase() === 'glc',
    );
    expect(glcRows.length).toBeLessThanOrEqual(1);
  });

  it('mostWanted should select promotion fields from search', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.mostWanted();

    const query = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(query).toContain('promotionTo');
    expect(query).toContain('highlightedTo');
    expect(query).toContain('renewTo');
    expect(query).toContain('renewInterval');
    expect(query).toContain('renewedTime');
    expect(query).toContain('mostWantedTo');
    expect(query).toContain('FROM search s');
    expect(query).toContain('INNER JOIN post p ON p.id = s.id');
    expect(query).toContain('p.dateCreated > ?');
    expect(query).toContain('ORDER BY s.mostWantedTo DESC, p.clicks DESC');
  });

  it('getCarDetails should decode base64 caption to text', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 42n,
          caption: 'SGVsbG8gZnJvbSBzZWFyY2g=',
          deleted: '0',
        },
      ]),
    } as any;

    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());
    const response = await service.getCarDetails('42');

    expect(response.success).toBe(true);
    expect(Array.isArray(response.result)).toBe(true);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: '42',
        caption: 'Hello from search',
      }),
    );
  });

  it('mostWanted should bind excluded ids/accounts as params, not SQL string concat', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.mostWanted("1,2,'3", "foo,bar' OR 1=1 --");

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    const query = call[0] as string;
    expect(query).toContain('s.id NOT IN (?,?,?)');
    expect(query).toContain('s.accountName NOT IN (?,?)');
    expect(query).not.toContain("bar' OR 1=1 --");
    expect(call.slice(2)).toEqual(
      expect.arrayContaining(['1', '2', "'3", 'foo', "bar' OR 1=1 --"]),
    );
  });

  it('mostWanted should apply a 2-day recency filter', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const before = Date.now();
    await service.mostWanted();
    const after = Date.now();

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    const recencyParam = call[1] as Date;
    expect(recencyParam).toBeInstanceOf(Date);

    const minExpected = before - 2 * 24 * 60 * 60 * 1000;
    const maxExpected = after - 2 * 24 * 60 * 60 * 1000;
    expect(recencyParam.getTime()).toBeGreaterThanOrEqual(minExpected);
    expect(recencyParam.getTime()).toBeLessThanOrEqual(maxExpected);
  });

  it('mostWanted should allow disabling recency filter via env', async () => {
    const previousRecency = process.env.MOST_WANTED_RECENCY_DAYS;
    process.env.MOST_WANTED_RECENCY_DAYS = '0';
    try {
      const prisma = {
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      } as any;
      const service = new LegacySearchService(
        prisma,
        new LegacySearchQueryBuilder(),
      );

      await service.mostWanted();

      const call = prisma.$queryRawUnsafe.mock.calls[0];
      const query = call[0] as string;
      expect(query).not.toContain('p.dateCreated > ?');
      expect(call).toHaveLength(1);
    } finally {
      if (previousRecency == null) {
        delete process.env.MOST_WANTED_RECENCY_DAYS;
      } else {
        process.env.MOST_WANTED_RECENCY_DAYS = previousRecency;
      }
    }
  });

  it('relatedById should use parameterized excluded ids list', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.relatedById('1', 'car', "2,3,'4");

    const call = prisma.$queryRawUnsafe.mock.calls.find((args: unknown[]) =>
      String(args[0]).includes('ORDER BY dateUpdated DESC, id DESC LIMIT ?'),
    ) as unknown[];
    const query = call[0] as string;
    expect(query).toContain('id NOT IN (?,?,?,?)');
    expect(call.slice(1)).toEqual(
      expect.arrayContaining(['BMW', 'X5', 'car', '2', '3', "'4", '1']),
    );
  });

  it('relatedByFilter should use parameterized excluded ids list', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.relatedByFilter(
      JSON.stringify({ searchTerms: [{ key: 'make1', value: 'BMW' }] }),
      'car',
      "10,11,'12",
    );

    const call = prisma.$queryRawUnsafe.mock.calls.find((args: unknown[]) =>
      String(args[0]).includes('ORDER BY dateUpdated DESC, id DESC LIMIT ?'),
    ) as unknown[];
    const query = call[0] as string;
    expect(query).toContain('id NOT IN (?,?,?)');
    expect(call.slice(1)).toEqual(
      expect.arrayContaining(['car', '10', '11', "'12", 'BMW']),
    );
  });
});
