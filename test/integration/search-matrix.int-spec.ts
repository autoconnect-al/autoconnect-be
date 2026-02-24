import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
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

    const response = await request(app.getHttpServer())
      .get('/car-details/related-post/5850')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({ id: '5851', promoted: true, highlighted: true }),
    );
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
