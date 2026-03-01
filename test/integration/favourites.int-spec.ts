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
import { LegacyFavouritesService } from '../../src/modules/legacy-favourites/legacy-favourites.service';

jest.setTimeout(120_000);

describe('Integration: favourites', () => {
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

  async function seedFavouritesGraph(): Promise<void> {
    await seedVendor(prisma, 7001n);
    await seedVendor(prisma, 7002n);
    await seedVendor(prisma, 7003n);

    await seedPostGraph(prisma, { postId: 7101n, vendorId: 7001n });
    await seedPostGraph(prisma, { postId: 7102n, vendorId: 7002n });
    await seedPostGraph(prisma, { postId: 7103n, vendorId: 7003n });

    await prisma.search.update({
      where: { id: 7102n },
      data: { sold: true },
    });

    await prisma.search.update({
      where: { id: 7103n },
      data: { deleted: '1' },
    });
  }

  it('GET /favourites/check returns only active ids from a valid list', async () => {
    await seedFavouritesGraph();

    const response = await request(app.getHttpServer())
      .get('/favourites/check?favourites=7101,7102,7103,not-a-number')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: ['7101'],
    });
  });

  it('GET /favourites/get returns matching rows and ignores invalid ids', async () => {
    await seedFavouritesGraph();
    await prisma.post.update({
      where: { id: 7101n },
      data: {
        impressions: 33,
        reach: 28,
        clicks: 12,
        contact: 4,
        contactCall: 2,
        contactWhatsapp: 1,
        contactEmail: 1,
        contactInstagram: 0,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/favourites/get?favourites=7101,7102,7103,x')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: '7101',
        deleted: '0',
        sold: false,
        impressions: 33,
        reach: 28,
        clicks: 12,
        contactCount: 4,
        contactCall: 2,
        contactWhatsapp: 1,
        contactEmail: 1,
        contactInstagram: 0,
      }),
    );
    expect(response.body.result[0]).not.toHaveProperty('postOpen');
  });

  it('favourites cache key normalization treats duplicate/reordered ids as the same request', async () => {
    await seedVendor(prisma, 7001n);
    await seedPostGraph(prisma, { postId: 7101n, vendorId: 7001n });

    const first = await request(app.getHttpServer())
      .get('/favourites/check?favourites=7101,7101,7101')
      .expect(200);

    expect(first.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: ['7101'],
    });

    await prisma.search.update({ where: { id: 7101n }, data: { sold: true } });

    const second = await request(app.getHttpServer())
      .get('/favourites/check?favourites=7101')
      .expect(200);

    expect(second.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: ['7101'],
    });
  });

  it('expired favourites cache entry is refreshed from DB on next request', async () => {
    await seedVendor(prisma, 7010n);
    await seedPostGraph(prisma, { postId: 7110n, vendorId: 7010n });

    const first = await request(app.getHttpServer())
      .get('/favourites/check?favourites=7110')
      .expect(200);
    expect(first.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: ['7110'],
    });

    await prisma.search.update({
      where: { id: 7110n },
      data: { sold: true },
    });

    const service = app.get(LegacyFavouritesService) as LegacyFavouritesService & {
      cache: Map<string, { expiresAt: number; value: unknown }>;
    };
    const cache = service.cache;
    for (const [key, entry] of cache) {
      if (key.startsWith('check:')) {
        cache.set(key, { ...entry, expiresAt: Date.now() - 1 });
      }
    }

    const second = await request(app.getHttpServer())
      .get('/favourites/check?favourites=7110')
      .expect(200);

    expect(second.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [],
    });
  });

  it('favourites endpoints return empty success for empty/invalid favourites lists', async () => {
    const invalidOnly = await request(app.getHttpServer())
      .get('/favourites/check?favourites=abc, ,?')
      .expect(200);

    expect(invalidOnly.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [],
    });

    const missing = await request(app.getHttpServer())
      .get('/favourites/get')
      .expect(200);

    expect(missing.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [],
    });
  });

  it('favourites endpoints return legacy 400 envelope when ID list exceeds limit', async () => {
    const oversized = Array.from({ length: 201 }, (_, index) => String(index + 1)).join(',');

    const checkResponse = await request(app.getHttpServer())
      .get(`/favourites/check?favourites=${oversized}`)
      .expect(200);

    expect(checkResponse.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Too many favourites IDs (max 200).',
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/favourites/get?favourites=${oversized}`)
      .expect(200);

    expect(getResponse.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Too many favourites IDs (max 200).',
    });
  });
});
