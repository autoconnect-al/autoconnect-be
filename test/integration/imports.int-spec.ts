import { INestApplication } from '@nestjs/common';
import { createServer, Server } from 'http';
import fs from 'fs/promises';
import path from 'path';
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
  seedPostGraph,
  seedVendor,
} from './fixtures/domain-fixtures';
import { PostImportService } from '../../src/modules/imports/services/post-import.service';
import { OpenAIService } from '../../src/modules/imports/services/openai.service';

jest.setTimeout(120_000);

describe('Integration: imports module', () => {
  let app: INestApplication;
  const prisma = getPrisma();
  const uploadRoot = path.resolve(
    process.cwd(),
    'tmp',
    'integration-imports-upload',
  );

  beforeAll(async () => {
    process.env.UPLOAD_DIR = uploadRoot;
    await waitForDatabaseReady();
    await runMigrationsOnce();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await disconnectDatabase();
  });

  async function waitForPostMetric(
    postId: bigint,
    assertFn: (post: {
      postOpen: number | null;
      clicks: number | null;
      impressions: number | null;
      reach: number | null;
      contact: number | null;
      contactWhatsapp: number | null;
    }) => boolean,
    timeoutMs = 3000,
  ): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          postOpen: true,
          clicks: true,
          impressions: true,
          reach: true,
          contact: true,
          contactWhatsapp: true,
        },
      });
      if (post && assertFn(post)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for post metric update');
  }

  async function withPngServer<T>(
    run: (baseUrl: string) => Promise<T>,
  ): Promise<T> {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
      'base64',
    );
    const server: Server = createServer((_, res) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'image/png');
      res.end(pngBuffer);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Could not start local PNG server');
    }
    const baseUrl = `http://127.0.0.1:${address.port.toString()}`;
    try {
      return await run(baseUrl);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  it('POST /posts/:postId/increment rejects invalid metric', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${FIXTURE_POST_ID.toString()}/increment?metric=invalid`)
      .expect(400);
  });

  it('POST /posts/:postId/increment queues inline postOpen increment and updates postOpen+clicks', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID);
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    const response = await request(app.getHttpServer())
      .post(`/posts/${FIXTURE_POST_ID.toString()}/increment?metric=postOpen`)
      .expect(202);

    expect(response.body).toMatchObject({ ok: true, status: 'queued-inline' });

    await waitForPostMetric(FIXTURE_POST_ID, (post) => (post.postOpen ?? 0) >= 1 && (post.clicks ?? 0) >= 1);
  });

  it('impressions with duplicate visitorId increments impressions twice and unique reach once', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID);
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    await request(app.getHttpServer())
      .post(`/posts/${FIXTURE_POST_ID.toString()}/increment?metric=impressions&visitorId=visitor-1`)
      .expect(202);
    await request(app.getHttpServer())
      .post(`/posts/${FIXTURE_POST_ID.toString()}/increment?metric=impressions&visitorId=visitor-1`)
      .expect(202);

    await waitForPostMetric(
      FIXTURE_POST_ID,
      (post) => (post.impressions ?? 0) >= 2 && (post.reach ?? 0) === 1,
      4000,
    );
  });

  it('contact metric with method increments both total contact and method-specific counter', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID);
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });

    await request(app.getHttpServer())
      .post(`/posts/${FIXTURE_POST_ID.toString()}/increment?metric=contact&contactMethod=whatsapp`)
      .expect(202);

    await waitForPostMetric(
      FIXTURE_POST_ID,
      (post) => (post.contact ?? 0) >= 1 && (post.contactWhatsapp ?? 0) >= 1,
    );
  });

  it('admin-guarded import triggers require admin auth and accept x-admin-code in queue-disabled mode', async () => {
    await request(app.getHttpServer()).post('/apify/import').expect(401);

    const apify = await request(app.getHttpServer())
      .post('/apify/import?downloadImages=0&useOpenAI=0')
      .set('x-admin-code', 'integration-admin-code')
      .expect(202);

    expect(apify.body).toMatchObject({
      ok: true,
      status: 'queued-inline',
    });

    const encar = await request(app.getHttpServer())
      .post('/encar/scrape?pages=2')
      .set('x-admin-code', 'integration-admin-code')
      .expect(202);

    expect(encar.body).toMatchObject({
      ok: true,
      pages: 2,
      status: 'queued-inline',
    });
  });

  it('PostImportService idempotency prevents replaying identical payloads', async () => {
    await seedVendor(prisma, 1n, { accountName: 'import-vendor-1' });
    const postImportService = app.get(PostImportService);

    const payload = {
      id: '8801',
      origin: 'INSTAGRAM',
      caption: 'import payload',
      createdTime: String(Math.floor(Date.now() / 1000)),
      likesCount: 1,
      viewsCount: 1,
      sidecarMedias: [],
      cardDetails: {
        make: 'BMW',
        model: 'X5',
        type: 'car',
      },
    };

    await postImportService.importPost(payload, 1, false, false, false);
    await postImportService.importPost(payload, 1, false, false, false);

    expect(await prisma.post.count({ where: { id: 8801n } })).toBe(1);

    const idempotencyRow = await prisma.$queryRawUnsafe<
      Array<{ status: string; attempts: bigint | number }>
    >(
      `
        SELECT status, attempts
        FROM import_idempotency
        WHERE idempotency_key = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      'INSTAGRAM:8801',
    );

    expect(idempotencyRow[0]?.status).toBe('completed');
    expect(Number(idempotencyRow[0]?.attempts ?? 0)).toBe(1);
  });

  it('PostImportService marks old existing posts as deleted during re-import', async () => {
    await seedVendor(prisma, 1n, { accountName: 'import-vendor-old' });
    await seedPostGraph(prisma, { postId: 8802n, vendorId: 1n });
    const oldCreatedTime = String(Math.floor(Date.now() / 1000) - 365 * 24 * 3600);
    await prisma.post.update({
      where: { id: 8802n },
      data: { createdTime: oldCreatedTime, deleted: false },
    });

    const postImportService = app.get(PostImportService);
    await postImportService.importPost(
      {
        id: '8802',
        origin: 'INSTAGRAM',
        caption: 'fresh caption',
        createdTime: String(Math.floor(Date.now() / 1000)),
        sidecarMedias: [],
      },
      1,
      false,
      false,
      false,
    );

    const post = await prisma.post.findUnique({ where: { id: 8802n } });
    expect(post?.deleted).toBe(true);
  });

  it('PostImportService sold-caption branch marks existing post/car_detail as deleted and sold', async () => {
    await seedVendor(prisma, 1n, { accountName: 'import-vendor-sold' });
    await seedPostGraph(prisma, { postId: 8803n, vendorId: 1n });

    const postImportService = app.get(PostImportService);
    await postImportService.importPost(
      {
        id: '8803',
        origin: 'INSTAGRAM',
        caption: 'Ky postim eshte shitur',
        createdTime: String(Math.floor(Date.now() / 1000)),
        sidecarMedias: [],
      },
      1,
      false,
      false,
      false,
    );

    const post = await prisma.post.findUnique({ where: { id: 8803n } });
    const details = await prisma.car_detail.findUnique({ where: { id: 8803n } });
    expect(post?.deleted).toBe(true);
    expect(details?.deleted).toBe(true);
    expect(details?.sold).toBe(true);
  });

  it('forceDownloadImagesDays prevents forced re-download for older posts and enables it for recent posts', async () => {
    await seedVendor(prisma, 1n, { accountName: 'import-vendor-images' });
    const postImportService = app.get(PostImportService);

    await withPngServer(async (baseUrl) => {
      const imageUrl = `${baseUrl}/image.png`;
      const oldCreated = String(Math.floor(Date.now() / 1000) - 10 * 24 * 3600);
      const recentCreated = String(Math.floor(Date.now() / 1000));

      await postImportService.importPost(
        {
          id: '8804',
          origin: 'INSTAGRAM',
          caption: 'old image import A',
          createdTime: oldCreated,
          sidecarMedias: [
            {
              id: 'img-old',
              imageStandardResolutionUrl: imageUrl,
              type: 'image',
            },
          ],
        },
        1,
        false,
        true,
        true,
        1,
      );
      const oldPostA = await prisma.post.findUnique({ where: { id: 8804n } });
      const oldMediasA = JSON.parse(String(oldPostA?.sidecarMedias ?? '[]')) as Array<{
        imageStandardResolutionUrl: string;
      }>;
      const oldImagePath = path.resolve(oldMediasA[0].imageStandardResolutionUrl);
      const oldStatA = await fs.stat(oldImagePath);
      await new Promise((resolve) => setTimeout(resolve, 50));

      await postImportService.importPost(
        {
          id: '8804',
          origin: 'INSTAGRAM',
          caption: 'old image import B',
          createdTime: oldCreated,
          sidecarMedias: [
            {
              id: 'img-old',
              imageStandardResolutionUrl: imageUrl,
              type: 'image',
            },
          ],
        },
        1,
        false,
        true,
        true,
        1,
      );
      const oldStatB = await fs.stat(oldImagePath);
      expect(oldStatB.mtimeMs).toBe(oldStatA.mtimeMs);

      await postImportService.importPost(
        {
          id: '8805',
          origin: 'INSTAGRAM',
          caption: 'recent image import A',
          createdTime: recentCreated,
          sidecarMedias: [
            {
              id: 'img-recent',
              imageStandardResolutionUrl: imageUrl,
              type: 'image',
            },
          ],
        },
        1,
        false,
        true,
        true,
        30,
      );
      const recentPostA = await prisma.post.findUnique({ where: { id: 8805n } });
      const recentMediasA = JSON.parse(
        String(recentPostA?.sidecarMedias ?? '[]'),
      ) as Array<{
        imageStandardResolutionUrl: string;
      }>;
      const recentImagePath = path.resolve(recentMediasA[0].imageStandardResolutionUrl);
      const recentStatA = await fs.stat(recentImagePath);
      await new Promise((resolve) => setTimeout(resolve, 50));

      await postImportService.importPost(
        {
          id: '8805',
          origin: 'INSTAGRAM',
          caption: 'recent image import B',
          createdTime: recentCreated,
          sidecarMedias: [
            {
              id: 'img-recent',
              imageStandardResolutionUrl: imageUrl,
              type: 'image',
            },
          ],
        },
        1,
        false,
        true,
        true,
        30,
      );
      const recentStatB = await fs.stat(recentImagePath);
      expect(recentStatB.mtimeMs).toBeGreaterThan(recentStatA.mtimeMs);
    });
  });

  it('useOpenAI=true uses OpenAI-derived details for new Instagram posts when service returns data', async () => {
    await seedVendor(prisma, 1n, { accountName: 'import-vendor-openai' });
    const postImportService = app.get(PostImportService);
    const openai = app.get(OpenAIService);
    const spy = jest.spyOn(openai, 'generateCarDetails').mockResolvedValue({
      make: 'BMW',
      model: 'X7',
      variant: 'M Sport',
      registration: 2022,
      mileage: 51000,
      transmission: 'Automatic',
      fuelType: 'Diesel',
      engineSize: '3.0',
      drivetrain: 'AWD',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 78000,
    });

    try {
      await postImportService.importPost(
        {
          id: '8806',
          origin: 'INSTAGRAM',
          caption: 'bmw x7 m sport 2022 diesel',
          createdTime: String(Math.floor(Date.now() / 1000)),
          sidecarMedias: [],
        },
        1,
        true,
        false,
        false,
      );
    } finally {
      spy.mockRestore();
    }

    const details = await prisma.car_detail.findUnique({ where: { id: 8806n } });
    expect(details).toMatchObject({
      make: 'BMW',
      model: 'X7',
      variant: 'M Sport',
      registration: '2022',
      mileage: 51000,
      transmission: 'Automatic',
      fuelType: 'Diesel',
      engineSize: '3.0',
      drivetrain: 'AWD',
      bodyType: 'SUV/Off-Road/Pick-up',
      price: 78000,
      published: true,
    });
  });
});
