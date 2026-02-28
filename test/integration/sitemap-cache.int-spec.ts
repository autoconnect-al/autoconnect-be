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

describe('Integration: sitemap cache behavior', () => {
  let app: INestApplication;
  const prisma = getPrisma();

  beforeAll(async () => {
    process.env.SITEMAP_CACHE_TTL_SECONDS = '1';
    await waitForDatabaseReady();
    await runMigrationsOnce();
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS article (
        id VARCHAR(100) NOT NULL,
        dateCreated DATETIME(0) NOT NULL,
        dateUpdated DATETIME(0) NULL,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        data LONGTEXT NULL,
        image VARCHAR(255) NULL,
        appName VARCHAR(255) NOT NULL DEFAULT 'autoconnect',
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await prisma.$executeRawUnsafe('DELETE FROM `article`');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await disconnectDatabase();
  });

  it('GET /sitemap/data returns cached result before TTL expiry and refreshes after TTL', async () => {
    await seedVendor(prisma, 9901n, {
      accountName: 'cache-vendor-1',
      username: 'cache_vendor_1',
      email: 'cache-vendor-1@example.com',
    });
    await seedPostGraph(prisma, { postId: 8801n, vendorId: 9901n });

    const first = await request(app.getHttpServer()).get('/sitemap/data').expect(200);
    const hasFirstId = first.body.result.some(
      (item: { url?: string }) =>
        typeof item.url === 'string' &&
        item.url.includes('/automjete/makine-ne-shitje/') &&
        item.url.includes('8801'),
    );
    expect(hasFirstId).toBe(true);

    await seedVendor(prisma, 9902n, {
      accountName: 'cache-vendor-2',
      username: 'cache_vendor_2',
      email: 'cache-vendor-2@example.com',
    });
    await seedPostGraph(prisma, { postId: 8802n, vendorId: 9902n });

    const second = await request(app.getHttpServer()).get('/sitemap/data').expect(200);
    const hasSecondIdOnCached = second.body.result.some(
      (item: { url?: string }) =>
        typeof item.url === 'string' &&
        item.url.includes('/automjete/makine-ne-shitje/') &&
        item.url.includes('8802'),
    );
    expect(hasSecondIdOnCached).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const third = await request(app.getHttpServer()).get('/sitemap/data').expect(200);
    const hasSecondIdAfterTtl = third.body.result.some(
      (item: { url?: string }) =>
        typeof item.url === 'string' &&
        item.url.includes('/automjete/makine-ne-shitje/') &&
        item.url.includes('8802'),
    );
    expect(hasSecondIdAfterTtl).toBe(true);
  });

  it('GET /sitemap/get-sitemap/:appName returns empty list for unknown app', async () => {
    const response = await request(app.getHttpServer())
      .get('/sitemap/get-sitemap/unknown-app')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [],
    });
  });

  it('GET /sitemap/get-sitemap/:appName returns article sitemap entries for configured app', async () => {
    await prisma.article.create({
      data: {
        id: 'ac-article-1',
        dateCreated: new Date(),
        title: 'Autoconnect article',
        category: 'cars',
        appName: 'autoconnect',
        data: JSON.stringify([
          { language: 'sq-al', title: 'Artikull Test' },
          { language: 'en', title: 'Test Article' },
        ]),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/sitemap/get-sitemap/autoconnect')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(response.body.result.length).toBeGreaterThan(0);
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        url: expect.stringContaining('/sq-al/artikull/Artikull-Test-ac-article-1'),
        alternates: {
          languages: {
            'sq-al': expect.stringContaining('/sq-al/artikull/Artikull-Test-ac-article-1'),
            en: expect.stringContaining('/en/article/Test-Article-ac-article-1'),
          },
        },
      }),
    );
  });
});
