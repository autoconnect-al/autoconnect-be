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

  it('GET /car-details/post/:id returns seeded details and 404 for missing id', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, { accountName: 'vendor-details' });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    const ok = await request(app.getHttpServer())
      .get(`/car-details/post/${FIXTURE_POST_ID.toString()}`)
      .expect(200);

    expect(ok.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(ok.body.result[0]).toEqual(
      expect.objectContaining({
        id: FIXTURE_POST_ID.toString(),
        make: 'BMW',
        model: 'X5',
      }),
    );

    const notFound = await request(app.getHttpServer())
      .get('/car-details/post/999999999')
      .expect(404);

    expect(notFound.body).toMatchObject({
      success: false,
      statusCode: '404',
      message: 'Car details not found',
    });
  });

  it('GET /car-details/post/caption/:id normalizes caption and returns mediaUrl', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, { accountName: 'vendor-caption' });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });
    await prisma.search.update({
      where: { id: FIXTURE_POST_ID },
      data: {
        cleanedCaption: 'Hello , world !  :  caption',
        sidecarMedias: JSON.stringify([
          { imageThumbnailUrl: 'https://example.invalid/media.webp' },
        ]),
      },
    });

    const ok = await request(app.getHttpServer())
      .get(`/car-details/post/caption/${FIXTURE_POST_ID.toString()}`)
      .expect(200);

    expect(ok.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: {
        cleanedCaption: 'Hello, world!:caption',
        mediaUrl: 'https://example.invalid/media.webp',
      },
    });

    const notFound = await request(app.getHttpServer())
      .get('/car-details/post/caption/999999999')
      .expect(404);

    expect(notFound.body).toMatchObject({
      success: false,
      statusCode: '404',
      message: 'Car details not found',
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

  it('GET /data/vendors and /data/vendors/biography handle hyphenated account names and normalize biography', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      accountName: 'vendor.edge',
      username: 'vendor_edge',
      email: 'vendor.edge@example.com',
    });
    await prisma.vendor.update({
      where: { id: FIXTURE_VENDOR_ID },
      data: {
        biography: 'Hello , world !  :  bio',
        initialised: true,
        accountExists: true,
      },
    });

    const vendorResponse = await request(app.getHttpServer())
      .get('/data/vendors/vendor-edge')
      .expect(200);

    expect(vendorResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: FIXTURE_VENDOR_ID.toString(),
        accountName: 'vendor.edge',
      }),
    });

    const biographyResponse = await request(app.getHttpServer())
      .get('/data/vendors/biography/vendor-edge')
      .expect(200);

    expect(biographyResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: {
        biography: 'Hello, world! :bio',
      },
    });
  });

  it('GET article endpoints apply language filtering and metadata handles missing id', async () => {
    const now = new Date();
    await prisma.article.createMany({
      data: [
        {
          id: 'cat-main',
          dateCreated: new Date(now.getTime() - 20_000),
          title: 'Main article',
          category: 'cars',
          appName: 'autoconnect',
          data: JSON.stringify([
            { language: 'en', title: 'English content' },
            { language: 'sq-al', title: 'Shqip content' },
          ]),
        },
        {
          id: 'cat-related',
          dateCreated: new Date(now.getTime() - 10_000),
          title: 'Related article',
          category: 'cars',
          appName: 'autoconnect',
          data: JSON.stringify([{ language: 'en', title: 'Related EN' }]),
        },
      ],
    });

    const articleEn = await request(app.getHttpServer())
      .get('/data/article/en/cat-main?app=autoconnect')
      .expect(200);
    expect(articleEn.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: 'cat-main',
      }),
    });
    expect(articleEn.body.result.data).toContain('English content');
    expect(articleEn.body.result.data).not.toContain('Shqip content');

    const related = await request(app.getHttpServer())
      .get('/data/related/articles/en/cars?app=autoconnect&excludeId=cat-main')
      .expect(200);
    expect(related.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(
      related.body.result.some((item: { id: string }) => item.id === 'cat-main'),
    ).toBe(false);

    const metadataMissing = await request(app.getHttpServer())
      .get('/data/metadata/articles/en/missing-id?app=autoconnect')
      .expect(200);
    expect(metadataMissing.body).toEqual({
      success: true,
      message: '',
      statusCode: '200',
    });
  });

  it('GET /data/articles, /total and /latest/articles apply app/category pagination semantics', async () => {
    const now = Date.now();
    await prisma.article.createMany({
      data: [
        {
          id: 'cars-1',
          dateCreated: new Date(now - 50_000),
          title: 'Cars one',
          category: 'cars',
          appName: 'autoconnect',
          data: JSON.stringify([{ language: 'en', title: 'Cars One EN' }]),
        },
        {
          id: 'cars-2',
          dateCreated: new Date(now - 40_000),
          title: 'Cars two',
          category: 'cars',
          appName: 'autoconnect',
          data: JSON.stringify([{ language: 'en', title: 'Cars Two EN' }]),
        },
        {
          id: 'cars-3',
          dateCreated: new Date(now - 30_000),
          title: 'Cars three',
          category: 'cars',
          appName: 'autoconnect',
          data: JSON.stringify([{ language: 'en', title: 'Cars Three EN' }]),
        },
        {
          id: 'moto-1',
          dateCreated: new Date(now - 20_000),
          title: 'Moto one',
          category: 'motorcycles',
          appName: 'autoconnect',
          data: JSON.stringify([{ language: 'en', title: 'Moto One EN' }]),
        },
        {
          id: 'other-app-1',
          dateCreated: new Date(now - 10_000),
          title: 'Other app article',
          category: 'cars',
          appName: 'rent-a-car-in-tirana',
          data: JSON.stringify([{ language: 'en', title: 'Other App EN' }]),
        },
      ],
    });

    const articlesPage1 = await request(app.getHttpServer())
      .get('/data/articles/en/cars?page=1&app=autoconnect')
      .expect(200);
    expect(articlesPage1.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(articlesPage1.body.result).toHaveLength(3);
    expect(
      articlesPage1.body.result.every(
        (row: { category: string }) => row.category === 'cars',
      ),
    ).toBe(true);

    const total = await request(app.getHttpServer())
      .get('/data/articles/en/cars/total?app=autoconnect')
      .expect(200);
    expect(total.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: 1,
    });

    const latest = await request(app.getHttpServer())
      .get('/data/latest/articles/en?app=autoconnect')
      .expect(200);
    expect(latest.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });

    const latestIds = latest.body.result.map((row: { id: string }) => row.id);
    expect(latestIds).toContain('cars-3');
    expect(latestIds).toContain('moto-1');
    expect(latestIds).not.toContain('other-app-1');
  });
});
