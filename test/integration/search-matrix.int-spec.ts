import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { createTestApp } from './helpers/create-test-app';
import {
  disconnectDatabase,
  getPrisma,
  resetDatabase,
  runMigrationsOnce,
  waitForDatabaseReady,
} from './helpers/db-lifecycle';
import { seedPostGraph, seedVendor } from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: search matrix', () => {
  let app: INestApplication;
  const prisma = getPrisma();
  const personalizationEnvKeys = [
    'PERSONALIZATION_ENABLED',
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
  const originalPersonalizationEnv = personalizationEnvKeys.reduce(
    (acc, key) => {
      acc[key] = process.env[key];
      return acc;
    },
    {} as Record<(typeof personalizationEnvKeys)[number], string | undefined>,
  );

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    for (const key of personalizationEnvKeys) {
      delete process.env[key];
    }
    process.env.PERSONALIZATION_ENABLED = 'false';
  });

  afterAll(async () => {
    for (const key of personalizationEnvKeys) {
      const value = originalPersonalizationEnv[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (app) {
      await app.close();
    }
    await disconnectDatabase();
  });

  async function seedSearchRecord(input: {
    postId: bigint;
    vendorId: bigint;
    accountName: string;
    make: string;
    model: string;
    price: number;
    mileage?: number;
    registration?: string;
    transmission?: string;
    fuelType?: string;
    bodyType?: string;
    emissionGroup?: string;
    customsPaid?: boolean | null;
    type?: string;
    cleanedCaption?: string;
    mostWantedTo?: number | null;
    promotionTo?: number | null;
    highlightedTo?: number | null;
    renewTo?: number | null;
    renewInterval?: string | null;
    renewedTime?: number | null;
    dateUpdated?: Date;
  }) {
    await seedVendor(prisma, input.vendorId, {
      accountName: input.accountName,
      username: `${input.accountName}_user`,
      email: `${input.accountName}@example.com`,
    });
    await seedPostGraph(prisma, {
      postId: input.postId,
      vendorId: input.vendorId,
    });

    await prisma.post.update({
      where: { id: input.postId },
      data: {
        createdTime: String(Math.floor(Date.now() / 1000)),
      },
    });

    await prisma.car_detail.update({
      where: { id: input.postId },
      data: {
        make: input.make,
        model: input.model,
        price: input.price,
        mileage: input.mileage ?? 100000,
        transmission: input.transmission ?? 'automatic',
        fuelType: input.fuelType ?? 'diesel',
        bodyType: input.bodyType ?? 'SUV',
        emissionGroup: input.emissionGroup ?? 'EURO 6',
        customsPaid: input.customsPaid ?? null,
        type: input.type ?? 'car',
      },
    });

    await prisma.search.update({
      where: { id: input.postId },
      data: {
        dateUpdated: input.dateUpdated ?? new Date(),
        accountName: input.accountName,
        vendorId: input.vendorId,
        make: input.make,
        model: input.model,
        price: input.price,
        mileage: input.mileage ?? 100000,
        registration: input.registration ?? '2020',
        transmission: input.transmission ?? 'automatic',
        fuelType: input.fuelType ?? 'diesel',
        bodyType: input.bodyType ?? 'SUV',
        emissionGroup: input.emissionGroup ?? 'EURO 6',
        customsPaid: input.customsPaid ?? null,
        type: input.type ?? 'car',
        cleanedCaption: input.cleanedCaption ?? `${input.make} ${input.model}`,
        promotionTo: input.promotionTo ?? null,
        highlightedTo: input.highlightedTo ?? null,
        renewTo: input.renewTo ?? null,
        renewInterval: input.renewInterval ?? null,
        renewedTime: input.renewedTime ?? null,
        mostWantedTo: input.mostWantedTo ?? null,
      },
      select: { id: true },
    });
  }

  function makeFilter(overrides: Record<string, unknown>) {
    return JSON.stringify({
      type: 'car',
      keyword: '',
      generalSearch: '',
      searchTerms: [],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
      page: 0,
      maxResults: 24,
      ...overrides,
    });
  }

  async function seedSearchRowsForCount(baseId: bigint, count: number) {
    const now = new Date();
    const vendorId = baseId + 1000000n;
    await seedVendor(prisma, vendorId, {
      accountName: `count-vendor-${vendorId.toString()}`,
      username: `count_user_${vendorId.toString()}`,
      email: `count_${vendorId.toString()}@example.com`,
    });
    const rows = Array.from({ length: count }, (_, index) => {
      const id = baseId + BigInt(index);
      return {
        id,
        dateCreated: now,
        dateUpdated: now,
        deleted: '0',
        cleanedCaption: `count-row-${index}`,
        type: 'car',
        sold: false,
        vendorId,
        accountName: `count-vendor-${vendorId.toString()}`,
        make: 'Count',
        model: 'Model',
        price: 1000 + index,
      };
    });
    await prisma.search.createMany({ data: rows });
  }

  async function seedVisitorInterestTerms(
    visitorId: string,
    terms: Array<{
      key: string;
      value: string;
      score: number;
      searchCount?: number;
      openCount?: number;
      contactCount?: number;
      impressionCount?: number;
    }>,
  ) {
    const visitorHash = createHash('sha256').update(visitorId).digest('hex');
    await prisma.$executeRawUnsafe(
      `INSERT INTO visitor_profile (visitor_hash, dateCreated, dateUpdated, lastSeenAt)
       VALUES (?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         dateUpdated = NOW(),
         lastSeenAt = NOW()`,
      visitorHash,
    );

    for (const term of terms) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO visitor_interest_term
          (visitor_hash, term_key, term_value, score, search_count, open_count, contact_count, impression_count, last_event_at, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score),
           search_count = VALUES(search_count),
           open_count = VALUES(open_count),
           contact_count = VALUES(contact_count),
           impression_count = VALUES(impression_count),
           last_event_at = NOW(),
           dateUpdated = NOW()`,
        visitorHash,
        term.key,
        term.value,
        term.score,
        term.searchCount ?? 0,
        term.openCount ?? 0,
        term.contactCount ?? 0,
        term.impressionCount ?? 0,
      );
    }
  }

  it('returns 500 envelope when filter JSON is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter: 'not-json' })
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      message: 'An error occurred while searching for cars',
      statusCode: '500',
    });
  });

  it('applies price range filter', async () => {
    await seedSearchRecord({
      postId: 5101n,
      vendorId: 6101n,
      accountName: 'range-a',
      make: 'BMW',
      model: 'X5',
      price: 10000,
    });
    await seedSearchRecord({
      postId: 5102n,
      vendorId: 6102n,
      accountName: 'range-b',
      make: 'BMW',
      model: 'X3',
      price: 25000,
    });

    const filter = makeFilter({
      searchTerms: [{ key: 'price', value: { from: '9000', to: '15000' } }],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5101', price: '10000' }),
    );
  });

  it('applies transmission/fuel/body in-clauses', async () => {
    await seedSearchRecord({
      postId: 5201n,
      vendorId: 6201n,
      accountName: 'in-a',
      make: 'Audi',
      model: 'A4',
      price: 17000,
      transmission: 'automatic',
      fuelType: 'diesel',
      bodyType: 'sedan',
    });
    await seedSearchRecord({
      postId: 5202n,
      vendorId: 6202n,
      accountName: 'in-b',
      make: 'Audi',
      model: 'A6',
      price: 18000,
      transmission: 'manual',
      fuelType: 'petrol',
      bodyType: 'wagon',
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'transmission', value: 'automatic' },
        { key: 'fuelType', value: 'diesel' },
        { key: 'bodyType', value: 'sedan' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5201', transmission: 'automatic' }),
    );
  });

  it('applies customsPaid filter (true includes null, excludes false)', async () => {
    await seedSearchRecord({
      postId: 5301n,
      vendorId: 6301n,
      accountName: 'customs-yes',
      make: 'VW',
      model: 'Golf',
      price: 9000,
      customsPaid: true,
    });
    await seedSearchRecord({
      postId: 5302n,
      vendorId: 6302n,
      accountName: 'customs-null',
      make: 'VW',
      model: 'Passat',
      price: 11000,
      customsPaid: null,
    });
    await seedSearchRecord({
      postId: 5303n,
      vendorId: 6303n,
      accountName: 'customs-no',
      make: 'VW',
      model: 'Polo',
      price: 7000,
      customsPaid: false,
    });

    const filter = makeFilter({
      searchTerms: [{ key: 'customsPaid', value: '1' }],
      sortTerms: [{ key: 'price', order: 'ASC' }],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    const ids = response.body.result.map((row: { id: string }) => row.id).sort();
    expect(ids).toEqual(['5301', '5302']);
  });

  it('excludes vendorId=1 by default and includes it for keyword=encar', async () => {
    await seedSearchRecord({
      postId: 5401n,
      vendorId: 1n,
      accountName: 'encar',
      make: 'Hyundai',
      model: 'i30',
      price: 12000,
      cleanedCaption: 'encar hyundai i30',
    });
    await seedSearchRecord({
      postId: 5402n,
      vendorId: 6402n,
      accountName: 'regular-vendor',
      make: 'Hyundai',
      model: 'Tucson',
      price: 22000,
    });

    const defaultFilter = makeFilter({});
    const defaultResponse = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter: defaultFilter })
      .expect(200);
    const defaultIds = defaultResponse.body.result.map((row: { id: string }) => row.id);
    expect(defaultIds).toContain('5402');
    expect(defaultIds).not.toContain('5401');

    const encarFilter = makeFilter({ keyword: 'encar' });
    const encarResponse = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter: encarFilter })
      .expect(200);
    const encarIds = encarResponse.body.result.map((row: { id: string }) => row.id);
    expect(encarIds).toContain('5401');
    expect(encarIds).not.toContain('5402');
  });

  it('supports generalSearch normalization (benc -> benz)', async () => {
    await seedSearchRecord({
      postId: 5501n,
      vendorId: 6501n,
      accountName: 'benz-vendor',
      make: 'benz',
      model: 'c-class',
      price: 21000,
      cleanedCaption: 'benz c class',
    });

    const filter = makeFilter({ generalSearch: 'benc' });
    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result.length).toBeGreaterThan(0);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5501', make: 'benz' }),
    );
  });

  it('applies sorting and pagination', async () => {
    await seedSearchRecord({
      postId: 5601n,
      vendorId: 6601n,
      accountName: 'sort-a',
      make: 'Skoda',
      model: 'Fabia',
      price: 5000,
    });
    await seedSearchRecord({
      postId: 5602n,
      vendorId: 6602n,
      accountName: 'sort-b',
      make: 'Skoda',
      model: 'Octavia',
      price: 8000,
    });
    await seedSearchRecord({
      postId: 5603n,
      vendorId: 6603n,
      accountName: 'sort-c',
      make: 'Skoda',
      model: 'Superb',
      price: 12000,
    });

    const filter = makeFilter({
      sortTerms: [{ key: 'price', order: 'ASC' }],
      page: 1,
      maxResults: 2,
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5603', price: '12000' }),
    );
  });

  it('default unfiltered search applies personalization for eligible visitor', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    await seedSearchRecord({
      postId: 5951n,
      vendorId: 6951n,
      accountName: 'personalized-audi',
      make: 'Audi',
      model: 'Q5',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 19000,
      renewedTime: 200,
    });
    await seedSearchRecord({
      postId: 5952n,
      vendorId: 6952n,
      accountName: 'personalized-bmw',
      make: 'BMW',
      model: 'X3',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 18500,
      renewedTime: 199,
    });
    await seedSearchRecord({
      postId: 5953n,
      vendorId: 6953n,
      accountName: 'personalized-vw',
      make: 'Volkswagen',
      model: 'Tiguan',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 17000,
      renewedTime: 198,
    });
    await seedSearchRecord({
      postId: 5954n,
      vendorId: 6954n,
      accountName: 'personalized-merc',
      make: 'Mercedes-benz',
      model: 'GLC',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 26000,
      renewedTime: 191,
    });
    await seedSearchRecord({
      postId: 5955n,
      vendorId: 6955n,
      accountName: 'personalized-toyota',
      make: 'Toyota',
      model: 'RAV4',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 16500,
      renewedTime: 197,
    });
    await seedSearchRecord({
      postId: 5956n,
      vendorId: 6956n,
      accountName: 'personalized-kia',
      make: 'Kia',
      model: 'Sportage',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 16000,
      renewedTime: 196,
    });

    await seedVisitorInterestTerms('visitor-default-feed', [
      {
        key: 'model',
        value: 'GLC',
        score: 220,
        openCount: 4,
        contactCount: 0,
      },
      {
        key: 'make',
        value: 'Mercedes-benz',
        score: 160,
        openCount: 3,
        contactCount: 0,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({
        filter: makeFilter({
          searchTerms: [{ key: 'type', value: 'car' }],
          sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
          maxResults: 6,
          visitorId: 'visitor-default-feed',
        }),
      })
      .expect(200);

    expect(response.body.result).toHaveLength(6);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5954',
        model: 'GLC',
      }),
    );
  });

  it('non-default sort remains unpersonalized even when visitor profile exists', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    await seedSearchRecord({
      postId: 5961n,
      vendorId: 6961n,
      accountName: 'sort-personalized-glc',
      make: 'Mercedes-benz',
      model: 'GLC',
      price: 32000,
      renewedTime: 190,
    });
    await seedSearchRecord({
      postId: 5962n,
      vendorId: 6962n,
      accountName: 'sort-personalized-cheap',
      make: 'Audi',
      model: 'A4',
      price: 9000,
      renewedTime: 200,
    });
    await seedSearchRecord({
      postId: 5963n,
      vendorId: 6963n,
      accountName: 'sort-personalized-mid',
      make: 'BMW',
      model: '320',
      price: 14000,
      renewedTime: 199,
    });

    await seedVisitorInterestTerms('visitor-custom-sort', [
      {
        key: 'model',
        value: 'GLC',
        score: 300,
        openCount: 7,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({
        filter: makeFilter({
          sortTerms: [{ key: 'price', order: 'ASC' }],
          maxResults: 3,
          visitorId: 'visitor-custom-sort',
        }),
      })
      .expect(200);

    expect(response.body.result).toHaveLength(3);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5962',
        price: '9000',
      }),
    );
  });

  it('search prepends filter-matching promoted row and sets highlighted flag', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5611n,
      vendorId: 6611n,
      accountName: 'search-match-promoted',
      make: 'BMW',
      model: 'X5',
      registration: '2021',
      fuelType: 'diesel',
      bodyType: 'SUV',
      price: 20000,
      promotionTo: now + 5000,
      highlightedTo: now + 5000,
      dateUpdated: new Date('2024-02-03T00:00:00Z'),
    });
    await seedSearchRecord({
      postId: 5612n,
      vendorId: 6612n,
      accountName: 'search-match-regular',
      make: 'BMW',
      model: 'X5',
      registration: '2021',
      fuelType: 'diesel',
      bodyType: 'SUV',
      price: 19000,
      dateUpdated: new Date('2024-02-02T00:00:00Z'),
    });

    const filter = makeFilter({
      maxResults: 1,
      sortTerms: [{ key: 'price', order: 'ASC' }],
      searchTerms: [
        { key: 'make1', value: 'BMW' },
        { key: 'model1', value: 'X5' },
        { key: 'registration', value: '2021' },
        { key: 'fuelType', value: 'diesel' },
        { key: 'bodyType', value: 'SUV' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result.length).toBe(2);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5611',
        promoted: true,
        highlighted: true,
      }),
    );
    expect(response.body.result[1]).toEqual(
      expect.objectContaining({
        id: '5612',
        promoted: false,
        highlighted: false,
      }),
    );
  });

  it('search falls back to global promoted row when filter match is unavailable', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5621n,
      vendorId: 6621n,
      accountName: 'search-fallback-regular',
      make: 'Skoda',
      model: 'Octavia',
      price: 10000,
    });
    await seedSearchRecord({
      postId: 5622n,
      vendorId: 6622n,
      accountName: 'search-fallback-promoted',
      make: 'Audi',
      model: 'A6',
      price: 25000,
      promotionTo: now + 5000,
      highlightedTo: now - 1,
      dateUpdated: new Date('2024-02-03T00:00:00Z'),
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Skoda' },
        { key: 'model1', value: 'Octavia' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5622',
        promoted: true,
        highlighted: false,
      }),
    );
  });

  it('search returns only non-promoted rows when no active promoted posts exist', async () => {
    await seedSearchRecord({
      postId: 5631n,
      vendorId: 6631n,
      accountName: 'search-none-a',
      make: 'Toyota',
      model: 'Corolla',
      price: 10000,
    });
    await seedSearchRecord({
      postId: 5632n,
      vendorId: 6632n,
      accountName: 'search-none-b',
      make: 'Toyota',
      model: 'Yaris',
      price: 9000,
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter: makeFilter({ searchTerms: [{ key: 'make1', value: 'Toyota' }] }) })
      .expect(200);

    expect(response.body.result.length).toBeGreaterThan(0);
    expect(
      response.body.result.every(
        (row: { promoted?: boolean; highlighted?: boolean }) =>
          row.promoted === false && typeof row.highlighted === 'boolean',
      ),
    ).toBe(true);
  });

  it('search de-duplicates promoted row when it also appears in regular query', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5641n,
      vendorId: 6641n,
      accountName: 'search-dedup-promoted',
      make: 'Seat',
      model: 'Ibiza',
      price: 8000,
      promotionTo: now + 5000,
      dateUpdated: new Date('2024-02-03T00:00:00Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({
        filter: makeFilter({
          maxResults: 24,
          searchTerms: [
            { key: 'make1', value: 'Seat' },
            { key: 'model1', value: 'Ibiza' },
          ],
        }),
      })
      .expect(200);

    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids.filter((id: string) => id === '5641')).toHaveLength(1);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5641',
        promoted: true,
      }),
    );
  });

  it('returns expected result-count for filtered data', async () => {
    await seedSearchRecord({
      postId: 5701n,
      vendorId: 6701n,
      accountName: 'count-a',
      make: 'Toyota',
      model: 'Corolla',
      price: 13000,
    });
    await seedSearchRecord({
      postId: 5702n,
      vendorId: 6702n,
      accountName: 'count-b',
      make: 'Toyota',
      model: 'Yaris',
      price: 9000,
    });

    const filter = makeFilter({
      searchTerms: [{ key: 'make1', value: 'Toyota' }],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/result-count')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 2,
    });
  });

  it('result-count applies legacy +500 branch when raw count is between 802 and 999', async () => {
    await seedSearchRowsForCount(700000n, 802);

    const response = await request(app.getHttpServer())
      .post('/car-details/result-count')
      .send({ filter: makeFilter({}) })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 1302,
    });
  });

  it('result-count applies legacy +1200 branch when raw count is between 1001 and 1999', async () => {
    await seedSearchRowsForCount(710000n, 1001);

    const response = await request(app.getHttpServer())
      .post('/car-details/result-count')
      .send({ filter: makeFilter({}) })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 2201,
    });
  });

  it('result-count preserves legacy boundary behavior at exactly 801', async () => {
    await seedSearchRowsForCount(720000n, 801);

    const response = await request(app.getHttpServer())
      .post('/car-details/result-count')
      .send({ filter: makeFilter({}) })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 5801,
    });
  });

  it('generalSearch ignores inputs longer than 75 characters', async () => {
    await seedSearchRecord({
      postId: 5731n,
      vendorId: 6731n,
      accountName: 'long-search',
      make: 'Lexus',
      model: 'RX',
      price: 17000,
      cleanedCaption: 'lexus rx long-search',
    });

    const longInput = 'x'.repeat(90);
    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter: makeFilter({ generalSearch: longInput }) })
      .expect(200);

    expect(response.body.result.length).toBeGreaterThan(0);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5731',
      }),
    );
  });

  it('generalSearch applies token cap of 10 terms', async () => {
    await seedSearchRecord({
      postId: 5741n,
      vendorId: 6741n,
      accountName: 'token-cap',
      make: 'Opel',
      model: 'Astra',
      price: 8000,
      cleanedCaption: 'token-eleven-only',
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({
        filter: makeFilter({
          generalSearch:
            't1 t2 t3 t4 t5 t6 t7 t8 t9 t10 token-eleven-only',
        }),
      })
      .expect(200);

    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids).not.toContain('5741');
  });

  it('returns related-post-filter data for make/model matches', async () => {
    await seedSearchRecord({
      postId: 5801n,
      vendorId: 6801n,
      accountName: 'related-a',
      make: 'Honda',
      model: 'Civic',
      price: 9000,
    });
    await seedSearchRecord({
      postId: 5802n,
      vendorId: 6802n,
      accountName: 'related-b',
      make: 'Honda',
      model: 'Civic',
      price: 10000,
    });
    await prisma.post.update({
      where: { id: 5802n },
      data: {
        impressions: 19,
        reach: 17,
        clicks: 6,
        contact: 3,
        contactCall: 1,
        contactWhatsapp: 1,
        contactEmail: 1,
        contactInstagram: 0,
      },
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Honda' },
        { key: 'model1', value: 'Civic' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/related-post-filter')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result.length).toBeGreaterThan(0);
    const enrichedRow = response.body.result.find(
      (row: { id: string }) => row.id === '5802',
    );
    expect(enrichedRow).toEqual(
      expect.objectContaining({
        impressions: 19,
        reach: 17,
        clicks: 6,
        contactCount: 3,
        contactCall: 1,
        contactWhatsapp: 1,
        contactEmail: 1,
        contactInstagram: 0,
      }),
    );
    expect(enrichedRow).not.toHaveProperty('postOpen');
  });

  it('related-post-filter returns matching promoted post first when available', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5811n,
      vendorId: 6811n,
      accountName: 'related-match-a',
      make: 'Audi',
      model: 'A4',
      registration: '2021',
      fuelType: 'diesel',
      bodyType: 'sedan',
      price: 9000,
      dateUpdated: new Date('2024-01-01T00:00:00Z'),
    });
    await seedSearchRecord({
      postId: 5812n,
      vendorId: 6812n,
      accountName: 'related-match-b',
      make: 'Audi',
      model: 'A4',
      registration: '2021',
      fuelType: 'diesel',
      bodyType: 'sedan',
      price: 9500,
      promotionTo: now + 3600,
      highlightedTo: now + 3600,
      dateUpdated: new Date('2024-01-02T00:00:00Z'),
    });
    await seedSearchRecord({
      postId: 5813n,
      vendorId: 6813n,
      accountName: 'global-promoted',
      make: 'BMW',
      model: 'X5',
      price: 15000,
      promotionTo: now + 7200,
      dateUpdated: new Date('2024-01-03T00:00:00Z'),
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Audi' },
        { key: 'model1', value: 'A4' },
        { key: 'registration', value: '2021' },
        { key: 'fuelType', value: 'diesel' },
        { key: 'bodyType', value: 'sedan' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/related-post-filter')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result.length).toBeLessThanOrEqual(4);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5812',
        promoted: true,
        highlighted: true,
      }),
    );
    const promotedCount = response.body.result.filter(
      (row: { promoted?: boolean }) => row.promoted,
    ).length;
    expect(promotedCount).toBe(1);
  });

  it('related-post-filter falls back to global promoted when no filter match exists', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5821n,
      vendorId: 6821n,
      accountName: 'fallback-a',
      make: 'Skoda',
      model: 'Octavia',
      price: 9000,
      dateUpdated: new Date('2024-01-01T00:00:00Z'),
    });
    await seedSearchRecord({
      postId: 5822n,
      vendorId: 6822n,
      accountName: 'fallback-b',
      make: 'Skoda',
      model: 'Octavia',
      price: 9500,
      dateUpdated: new Date('2024-01-02T00:00:00Z'),
    });
    await seedSearchRecord({
      postId: 5823n,
      vendorId: 6823n,
      accountName: 'fallback-global',
      make: 'Honda',
      model: 'Civic',
      price: 12000,
      promotionTo: now + 4000,
      dateUpdated: new Date('2024-01-03T00:00:00Z'),
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Skoda' },
        { key: 'model1', value: 'Octavia' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/related-post-filter')
      .send({ filter })
      .expect(200);

    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5823', promoted: true }),
    );
    expect(
      response.body.result.every(
        (row: { promoted?: boolean; id: string }, index: number) =>
          index === 0 || !row.promoted,
      ),
    ).toBe(true);
  });

  it('related-post-filter returns non-promoted rows when no promoted posts are available', async () => {
    await seedSearchRecord({
      postId: 5831n,
      vendorId: 6831n,
      accountName: 'none-a',
      make: 'Toyota',
      model: 'Rav4',
      price: 18000,
    });
    await seedSearchRecord({
      postId: 5832n,
      vendorId: 6832n,
      accountName: 'none-b',
      make: 'Toyota',
      model: 'Rav4',
      price: 17000,
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Toyota' },
        { key: 'model1', value: 'Rav4' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/related-post-filter')
      .send({ filter })
      .expect(200);

    expect(response.body.result.length).toBeGreaterThan(0);
    expect(
      response.body.result.every((row: { promoted?: boolean }) => !row.promoted),
    ).toBe(true);
  });

  it('related-post-filter respects excludedIds and never returns excluded promoted post', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5841n,
      vendorId: 6841n,
      accountName: 'exclude-a',
      make: 'Seat',
      model: 'Ibiza',
      price: 8000,
      promotionTo: now + 3000,
    });
    await seedSearchRecord({
      postId: 5842n,
      vendorId: 6842n,
      accountName: 'exclude-b',
      make: 'Seat',
      model: 'Ibiza',
      price: 8200,
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'Seat' },
        { key: 'model1', value: 'Ibiza' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/related-post-filter?excludedIds=5841')
      .send({ filter })
      .expect(200);

    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids).not.toContain('5841');
  });

  it('related-post/:id returns matching promoted post first when available', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5850n,
      vendorId: 6850n,
      accountName: 'base-post',
      make: 'BMW',
      model: 'X5',
      registration: '2020',
      fuelType: 'diesel',
      bodyType: 'SUV',
      price: 20000,
    });
    await seedSearchRecord({
      postId: 5851n,
      vendorId: 6851n,
      accountName: 'promoted-match',
      make: 'BMW',
      model: 'X5',
      registration: '2020',
      fuelType: 'diesel',
      bodyType: 'SUV',
      price: 21000,
      promotionTo: now + 6000,
      highlightedTo: now + 6000,
    });
    await seedSearchRecord({
      postId: 5852n,
      vendorId: 6852n,
      accountName: 'non-promoted-match',
      make: 'BMW',
      model: 'X5',
      registration: '2019',
      fuelType: 'diesel',
      bodyType: 'SUV',
      price: 19000,
    });
    await prisma.post.update({
      where: { id: 5851n },
      data: {
        impressions: 80,
        reach: 65,
        clicks: 30,
        contact: 10,
        contactCall: 4,
        contactWhatsapp: 4,
        contactEmail: 1,
        contactInstagram: 1,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/car-details/related-post/5850')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '5851',
        promoted: true,
        highlighted: true,
        impressions: 80,
        reach: 65,
        clicks: 30,
        contactCount: 10,
        contactCall: 4,
        contactWhatsapp: 4,
        contactEmail: 1,
        contactInstagram: 1,
      }),
    );
    expect(response.body.result[0]).not.toHaveProperty('postOpen');
    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids).not.toContain('5850');
  });

  it('related-post/:id falls back to global promoted when match is unavailable', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5860n,
      vendorId: 6860n,
      accountName: 'base-fallback',
      make: 'Peugeot',
      model: '308',
      price: 9000,
    });
    await seedSearchRecord({
      postId: 5861n,
      vendorId: 6861n,
      accountName: 'global-fallback',
      make: 'Mazda',
      model: 'CX-5',
      price: 16000,
      promotionTo: now + 5000,
    });
    await seedSearchRecord({
      postId: 5862n,
      vendorId: 6862n,
      accountName: 'fallback-related',
      make: 'Peugeot',
      model: '308',
      price: 9200,
    });

    const response = await request(app.getHttpServer())
      .get('/car-details/related-post/5860')
      .expect(200);

    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5861', promoted: true }),
    );
  });

  it('related-post/:id returns non-promoted rows when no promoted posts are available', async () => {
    await seedSearchRecord({
      postId: 5870n,
      vendorId: 6870n,
      accountName: 'base-no-promoted',
      make: 'Kia',
      model: 'Sportage',
      price: 13000,
    });
    await seedSearchRecord({
      postId: 5871n,
      vendorId: 6871n,
      accountName: 'related-no-promoted',
      make: 'Kia',
      model: 'Sportage',
      price: 12500,
    });

    const response = await request(app.getHttpServer())
      .get('/car-details/related-post/5870')
      .expect(200);

    expect(response.body.result.length).toBeGreaterThan(0);
    expect(
      response.body.result.every((row: { promoted?: boolean }) => !row.promoted),
    ).toBe(true);
  });

  it('most-wanted honors exclusions and returns promotion projection fields', async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5881n,
      vendorId: 6881n,
      accountName: 'most-a',
      make: 'Ford',
      model: 'Focus',
      price: 7000,
      mostWantedTo: now + 5000,
      promotionTo: now + 5000,
    });
    await seedSearchRecord({
      postId: 5882n,
      vendorId: 6882n,
      accountName: 'most-b',
      make: 'Ford',
      model: 'Fiesta',
      price: 6500,
      mostWantedTo: now + 4000,
      promotionTo: now + 4000,
    });
    await seedSearchRecord({
      postId: 5883n,
      vendorId: 6883n,
      accountName: 'most-excluded-account',
      make: 'Ford',
      model: 'Kuga',
      price: 11000,
      mostWantedTo: now + 3000,
      promotionTo: now + 3000,
    });
    await prisma.post.update({
      where: { id: 5881n },
      data: {
        impressions: 70,
        reach: 66,
        clicks: 22,
        contact: 7,
        contactCall: 3,
        contactWhatsapp: 2,
        contactEmail: 1,
        contactInstagram: 1,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/car-details/most-wanted?excludeIds=5882&excludedAccounts=most-excluded-account')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids).not.toContain('5882');
    expect(
      response.body.result.some(
        (row: { accountName: string }) =>
          row.accountName === 'most-excluded-account',
      ),
    ).toBe(false);
    expect(response.body.result[0]).toHaveProperty('promotionTo');
    expect(response.body.result[0]).toHaveProperty('highlightedTo');
    expect(response.body.result[0]).toHaveProperty('renewTo');
    expect(response.body.result[0]).toHaveProperty('renewInterval');
    expect(response.body.result[0]).toHaveProperty('renewedTime');
    expect(response.body.result[0]).toHaveProperty('mostWantedTo');
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        impressions: 70,
        reach: 66,
        clicks: 22,
        contactCount: 7,
        contactCall: 3,
        contactWhatsapp: 2,
        contactEmail: 1,
        contactInstagram: 1,
      }),
    );
    expect(response.body.result[0]).not.toHaveProperty('postOpen');
  });

  it('most-wanted applies personalization caps while honoring exclusions', async () => {
    process.env.PERSONALIZATION_ENABLED = 'true';
    const now = Math.floor(Date.now() / 1000);
    await seedSearchRecord({
      postId: 5891n,
      vendorId: 6891n,
      accountName: 'most-personalized-1',
      make: 'Mercedes-benz',
      model: 'GLC',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 32000,
      mostWantedTo: now + 6000,
      renewedTime: now + 6000,
    });
    await seedSearchRecord({
      postId: 5892n,
      vendorId: 6892n,
      accountName: 'most-personalized-2',
      make: 'Mercedes-benz',
      model: 'GLC',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 31000,
      mostWantedTo: now + 5900,
      renewedTime: now + 5900,
    });
    await seedSearchRecord({
      postId: 5893n,
      vendorId: 6893n,
      accountName: 'most-personalized-3',
      make: 'Mercedes-benz',
      model: 'GLC',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 30000,
      mostWantedTo: now + 5800,
      renewedTime: now + 5800,
    });
    await seedSearchRecord({
      postId: 5894n,
      vendorId: 6894n,
      accountName: 'most-personalized-4',
      make: 'Audi',
      model: 'Q5',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 27000,
      mostWantedTo: now + 5700,
      renewedTime: now + 5700,
    });
    await seedSearchRecord({
      postId: 5895n,
      vendorId: 6895n,
      accountName: 'most-personalized-5',
      make: 'BMW',
      model: 'X3',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 26500,
      mostWantedTo: now + 5600,
      renewedTime: now + 5600,
    });
    await seedSearchRecord({
      postId: 5896n,
      vendorId: 6896n,
      accountName: 'most-personalized-6',
      make: 'Volkswagen',
      model: 'Tiguan',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 25000,
      mostWantedTo: now + 5500,
      renewedTime: now + 5500,
    });

    await seedVisitorInterestTerms('visitor-most-wanted', [
      {
        key: 'model',
        value: 'GLC',
        score: 210,
        openCount: 6,
      },
      {
        key: 'make',
        value: 'Mercedes-benz',
        score: 180,
        openCount: 5,
      },
      {
        key: 'bodyType',
        value: 'SUV/Off-Road/Pick-up',
        score: 120,
        openCount: 4,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/car-details/most-wanted?visitorId=visitor-most-wanted&excludeIds=5893')
      .expect(200);

    expect(response.body.result).toHaveLength(4);
    const ids = response.body.result.map((row: { id: string }) => row.id);
    expect(ids).not.toContain('5893');
    const glcRows = response.body.result.filter(
      (row: { model: string }) => row.model.toLowerCase() === 'glc',
    );
    expect(glcRows.length).toBeLessThanOrEqual(1);
  });

  it('price-calculate returns rows when required terms are provided', async () => {
    await seedSearchRecord({
      postId: 5901n,
      vendorId: 6901n,
      accountName: 'price-calc-a',
      make: 'BMW',
      model: 'X5',
      price: 30000,
      transmission: 'automatic',
      fuelType: 'diesel',
      bodyType: 'SUV',
      customsPaid: true,
    });

    const filter = makeFilter({
      searchTerms: [
        { key: 'make1', value: 'BMW' },
        { key: 'model1', value: 'X5' },
        { key: 'registration', value: { from: '2020' } },
        { key: 'fuelType', value: 'diesel' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/price-calculate')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});
