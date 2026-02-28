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
  buildCreateOrderPayload,
  buildCreatePostPayload,
  FIXTURE_POST_ID,
  FIXTURE_PROMOTION_PACKAGE_ID,
  FIXTURE_VENDOR_ID,
  seedPostGraph,
  seedPromotionPackage,
  seedVendor,
} from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: write flows and payments', () => {
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

  it('POST /data/create-post persists post and car_detail rows only', async () => {
    await seedVendor(prisma);
    const payload = buildCreatePostPayload();

    const response = await request(app.getHttpServer())
      .post('/data/create-post')
      .send(payload)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Post saved successfully',
      result: { postId: FIXTURE_POST_ID.toString() },
    });

    const post = await prisma.post.findUnique({
      where: { id: FIXTURE_POST_ID },
    });
    const details = await prisma.car_detail.findUnique({
      where: { id: FIXTURE_POST_ID },
    });
    const search = await prisma.search.findUnique({
      where: { id: FIXTURE_POST_ID },
    });

    expect(post).toBeTruthy();
    expect(post?.vendor_id).toBe(FIXTURE_VENDOR_ID);
    expect(post?.cleanedCaption).toBe('Hello integration test');

    expect(details).toBeTruthy();
    expect(details?.price).toBe(15500);

    expect(search).toBeNull();
  });

  it('POST /data/create-post returns legacy error envelope and does not write rows for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/create-post')
      .send({ post: {} })
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      message: 'ERROR: Something went wrong',
      statusCode: '500',
    });

    const postCount = await prisma.post.count();
    expect(postCount).toBe(0);
  });

  it('POST /data/update-post updates post and car_detail without syncing search', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);

    const payload = buildCreatePostPayload({
      caption: 'Updated caption from integration',
      price: 19000,
    });

    const response = await request(app.getHttpServer())
      .post('/data/update-post')
      .send(payload)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Post saved successfully',
      result: { postId: FIXTURE_POST_ID.toString() },
    });

    const post = await prisma.post.findUnique({
      where: { id: FIXTURE_POST_ID },
    });
    const details = await prisma.car_detail.findUnique({
      where: { id: FIXTURE_POST_ID },
    });
    const search = await prisma.search.findUnique({
      where: { id: FIXTURE_POST_ID },
    });

    expect(post?.cleanedCaption).toBe('Updated caption from integration');
    expect(details?.price).toBe(19000);
    expect(search?.price).toBeNull();
  });

  it('POST /data/update-post does not allow untrusted promotion field overwrites', async () => {
    const oldPromotionTo = Math.floor(Date.now() / 1000) + 10_000;
    const oldHighlightedTo = Math.floor(Date.now() / 1000) + 20_000;
    const oldRenewTo = Math.floor(Date.now() / 1000) + 30_000;
    const oldMostWantedTo = Math.floor(Date.now() / 1000) + 40_000;

    await seedVendor(prisma);
    await seedPostGraph(prisma, {
      promotionTo: oldPromotionTo,
      highlightedTo: oldHighlightedTo,
      renewTo: oldRenewTo,
      mostWantedTo: oldMostWantedTo,
      renewInterval: '14d',
      renewedTime: 1,
    });

    const payload = buildCreatePostPayload({
      promotionTo: oldPromotionTo + 9999,
      highlightedTo: oldHighlightedTo + 9999,
      renewTo: oldRenewTo + 9999,
      mostWantedTo: oldMostWantedTo + 9999,
      renewInterval: '99d',
      renewedTime: 999,
    });

    await request(app.getHttpServer())
      .post('/data/update-post')
      .send(payload)
      .expect(200);

    const post = await prisma.post.findUnique({
      where: { id: FIXTURE_POST_ID },
    });

    expect(post?.promotionTo).toBe(oldPromotionTo);
    expect(post?.highlightedTo).toBe(oldHighlightedTo);
    expect(post?.renewTo).toBe(oldRenewTo);
    expect(post?.mostWantedTo).toBe(oldMostWantedTo);
    expect(post?.renewInterval).toBe('14d');
    expect(post?.renewedTime).toBe(1);
  });

  it('POST /data/create-user-post creates a vendor and post graph when email does not exist', async () => {
    const unique = Date.now();
    const postId = 5201n;
    const email = `create-user-post-${unique}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/data/create-user-post')
      .send({
        post: {
          id: postId.toString(),
          email,
          username: `create_user_post_${unique}`,
          name: 'Create User Post',
          phone: '0693333333',
          whatsapp: '0693333333',
          location: 'Tirana',
          caption: 'Create user post integration',
          createdTime: String(Math.floor(Date.now() / 1000)),
          cardDetails: {
            make: 'BMW',
            model: 'X5',
            type: 'car',
            transmission: 'automatic',
            fuelType: 'diesel',
            price: 21000,
            sold: false,
            published: false,
          },
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'User and post created successfully',
      result: {
        jwt: expect.any(String),
        postId: postId.toString(),
      },
    });
    expect(String(response.body.result.jwt).length).toBeGreaterThan(20);

    const vendor = await prisma.vendor.findFirst({
      where: { email },
      select: { id: true, email: true, username: true },
    });
    expect(vendor).toBeTruthy();

    const post = await prisma.post.findUnique({ where: { id: postId } });
    const details = await prisma.car_detail.findUnique({ where: { id: postId } });
    const search = await prisma.search.findUnique({ where: { id: postId } });

    expect(post?.vendor_id).toBe(vendor?.id);
    expect(details?.post_id).toBe(postId);
    expect(search).toBeNull();
  });

  it('POST /data/create-user-post returns legacy 500 envelope for missing user email', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/create-user-post')
      .send({
        post: {
          id: '5301',
          caption: 'Invalid create-user-post payload',
          createdTime: String(Math.floor(Date.now() / 1000)),
          cardDetails: {
            make: 'BMW',
            model: 'X3',
            type: 'car',
            price: 12000,
          },
        },
      })
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '500',
      message: 'ERROR: Something went wrong',
    });

    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.vendor.count()).toBe(0);
  });

  it('POST /api/v1/orders creates order in CREATED state', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload())
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: 'CREATED',
        links: expect.any(Array),
      }),
    );

    const order = await prisma.customer_orders.findFirst({
      where: { paypalId: response.body.id },
    });
    expect(order).toBeTruthy();
    expect(order?.status).toBe('CREATED');
    expect(order?.postId).toBe(FIXTURE_POST_ID.toString());
  });

  it('POST /api/v1/orders returns 404 when cart packages do not exist', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload({ packageId: 999999 }))
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '404',
      message: 'ERROR: Something went wrong',
    });

    const count = await prisma.customer_orders.count();
    expect(count).toBe(0);
  });

  it('POST /api/v1/orders returns 403 for owner mismatch when email does not match post vendor', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      email: 'owner@example.com',
      username: 'owner_user',
      accountName: 'owner-vendor',
    });
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload({ email: 'other@example.com' }))
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '403',
      message: 'ERROR: Something went wrong',
    });
  });

  it('POST /api/v1/orders/:orderID/capture completes order and updates promotion fields', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma, FIXTURE_PROMOTION_PACKAGE_ID);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload())
      .expect(200);

    const orderId = createResponse.body.id as string;

    const captureResponse = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/capture`)
      .expect(200);

    expect(captureResponse.body).toEqual(
      expect.objectContaining({
        id: orderId,
        status: 'COMPLETED',
        captureKey: `capture:${orderId}`,
      }),
    );

    const order = await prisma.customer_orders.findFirst({
      where: { paypalId: orderId },
    });
    const post = await prisma.post.findUnique({ where: { id: FIXTURE_POST_ID } });
    const search = await prisma.search.findUnique({
      where: { id: FIXTURE_POST_ID },
    });

    expect(order?.status).toBe('COMPLETED');
    expect(order?.capturedAt).toBeTruthy();
    expect(post?.promotionTo).toBeTruthy();
    expect(search?.promotionTo).toBe(post?.promotionTo ?? null);
  });

  it('captured promotion is discoverable by related-post-filter as promoted result', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);
    await seedVendor(prisma, 1002n);
    await seedPostGraph(prisma, { postId: 2002n, vendorId: 1002n });
    await seedPromotionPackage(prisma, FIXTURE_PROMOTION_PACKAGE_ID);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload())
      .expect(200);
    const orderId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/capture`)
      .expect(200);

    const filter = JSON.stringify({
      type: 'car',
      keyword: '',
      generalSearch: '',
      searchTerms: [
        { key: 'make1', value: 'BMW' },
        { key: 'model1', value: 'X5' },
      ],
      sortTerms: [{ key: 'renewedTime', order: 'DESC' }],
      page: 0,
      maxResults: 24,
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
    expect(response.body.result[0]).toEqual(
      expect.objectContaining({
        id: FIXTURE_POST_ID.toString(),
        promoted: true,
      }),
    );
  });

  it('POST /api/v1/orders/:orderID/capture is idempotent', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload())
      .expect(200);

    const orderId = createResponse.body.id as string;

    const firstCapture = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/capture`)
      .expect(200);
    const secondCapture = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/capture`)
      .expect(200);

    expect(firstCapture.body.status).toBe('COMPLETED');
    expect(secondCapture.body.status).toBe('COMPLETED');
    expect(secondCapture.body.captureKey).toBe(firstCapture.body.captureKey);

    const orders = await prisma.customer_orders.findMany({
      where: { paypalId: orderId },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.status).toBe('COMPLETED');
  });

  it('POST /api/v1/orders/:orderID/capture returns 403 for owner mismatch', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      email: 'post-owner@example.com',
      username: 'post_owner',
      accountName: 'post-owner',
    });
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma);

    await prisma.customer_orders.create({
      data: {
        id: 987654321n,
        dateCreated: new Date(),
        deleted: false,
        paypalId: 'LOCAL-owner-mismatch',
        postId: FIXTURE_POST_ID.toString(),
        packages: String(FIXTURE_PROMOTION_PACKAGE_ID),
        email: 'different-owner@example.com',
        status: 'CREATED',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders/LOCAL-owner-mismatch/capture')
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '403',
      message: 'ERROR: Something went wrong',
    });
  });

  it('POST /api/v1/orders/:orderID/capture returns 409 for invalid transition state', async () => {
    await seedVendor(prisma);
    await seedPostGraph(prisma);
    await seedPromotionPackage(prisma);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(buildCreateOrderPayload())
      .expect(200);
    const orderId = createResponse.body.id as string;

    await prisma.customer_orders.updateMany({
      where: { paypalId: orderId },
      data: { status: 'CAPTURE_MISMATCH' },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/capture`)
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '409',
      message: 'ERROR: Something went wrong',
    });
  });

  it('POST /api/v1/orders/:orderID/capture returns 404 for unknown order', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders/LOCAL-missing/capture')
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '404',
      message: 'ERROR: Something went wrong',
    });
  });
});
