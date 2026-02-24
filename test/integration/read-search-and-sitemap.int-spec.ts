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
import {
  FIXTURE_POST_ID,
  FIXTURE_VENDOR_ID,
  seedCarMakeModel,
  seedPostGraph,
  seedVendor,
} from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: read/search/sitemap', () => {
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

  it('GET /data/makes returns seeded car make list', async () => {
    await seedCarMakeModel(prisma, {
      id: 1,
      make: 'BMW',
      model: 'X5',
      type: 'car',
    });
    await seedCarMakeModel(prisma, {
      id: 2,
      make: 'Audi',
      model: 'A4',
      type: 'car',
    });
    await seedCarMakeModel(prisma, {
      id: 3,
      make: 'Yamaha',
      model: 'Tracer',
      type: 'motorcycle',
    });

    const response = await request(app.getHttpServer())
      .get('/data/makes')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.arrayContaining(['Audi', 'BMW']),
    });
    expect(response.body.result).not.toContain('Yamaha');
  });

  it('POST /car-details/search returns seeded search rows for matching filter', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, { accountName: 'vendor-read' });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    const filter = JSON.stringify({
      type: 'car',
      searchTerms: [],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
      page: 0,
      maxResults: 24,
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/search')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result.length).toBeGreaterThan(0);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: FIXTURE_POST_ID.toString(),
        make: 'BMW',
        model: 'X5',
      }),
    );
  });

  it('POST /car-details/result-count returns deterministic count for matching filter', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, { accountName: 'vendor-count' });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    const filter = JSON.stringify({
      type: 'car',
      searchTerms: [],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
      page: 0,
      maxResults: 24,
    });

    const response = await request(app.getHttpServer())
      .post('/car-details/result-count')
      .send({ filter })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 1,
    });
  });

  it('GET /sitemap/data returns generated sitemap entries', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, { accountName: 'vendor-sitemap' });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    const response = await request(app.getHttpServer())
      .get('/sitemap/data')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result.length).toBeGreaterThan(0);

    const hasCarDetailPath = response.body.result.some(
      (item: { url?: string }) =>
        typeof item?.url === 'string' &&
        item.url.includes('/automjete/makine-ne-shitje/'),
    );
    expect(hasCarDetailPath).toBe(true);
  });
});
