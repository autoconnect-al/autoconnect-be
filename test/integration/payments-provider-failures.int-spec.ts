import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  disconnectDatabase,
  getPrisma,
  resetDatabase,
  runMigrationsOnce,
  waitForDatabaseReady,
} from './helpers/db-lifecycle';
import {
  FIXTURE_POST_ID,
  FIXTURE_PROMOTION_PACKAGE_ID,
  FIXTURE_VENDOR_ID,
  seedPostGraph,
  seedPromotionPackage,
  seedVendor,
} from './fixtures/domain-fixtures';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../src/modules/legacy-payments/payment-provider';

jest.setTimeout(120_000);

describe('Integration: payments provider failures', () => {
  let app: INestApplication;
  const prisma = getPrisma();

  const failingProvider: PaymentProvider = {
    async createOrder() {
      throw new Error('provider-create-failure');
    },
    async captureOrder() {
      throw new Error('provider-capture-failure');
    },
    async verifyWebhookSignature() {
      return false;
    },
  };

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(failingProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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

  it('POST /api/v1/orders returns 502 when provider create-order throws', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      accountName: 'provider-fail-vendor',
      username: 'provider_fail_vendor',
      email: 'provider-fail-vendor@example.com',
    });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });
    await seedPromotionPackage(prisma, FIXTURE_PROMOTION_PACKAGE_ID);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({
        post_id: FIXTURE_POST_ID.toString(),
        cart: [{ id: String(FIXTURE_PROMOTION_PACKAGE_ID) }],
      })
      .expect(502);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '502',
      message: 'ERROR: Something went wrong',
    });
  });

  it('POST /api/v1/orders/:orderID/capture returns 502 when provider capture throws', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      accountName: 'provider-fail-capture',
      username: 'provider_fail_capture',
      email: 'provider-fail-capture@example.com',
    });
    await seedPostGraph(prisma, { postId: FIXTURE_POST_ID, vendorId: FIXTURE_VENDOR_ID });
    await seedPromotionPackage(prisma, FIXTURE_PROMOTION_PACKAGE_ID);

    await prisma.customer_orders.create({
      data: {
        id: 123450987n,
        dateCreated: new Date(),
        deleted: false,
        paypalId: 'LOCAL-provider-capture',
        postId: FIXTURE_POST_ID.toString(),
        packages: String(FIXTURE_PROMOTION_PACKAGE_ID),
        status: 'CREATED',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders/LOCAL-provider-capture/capture')
      .expect(502);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '502',
      message: 'ERROR: Something went wrong',
    });
  });

  it('POST /api/v1/orders/paypal/webhook returns 400 for invalid webhook signature', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders/paypal/webhook')
      .send({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-1' },
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Invalid PayPal webhook signature',
    });
  });
});
