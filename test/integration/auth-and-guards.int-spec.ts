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
import bcrypt from 'bcrypt';
import {
  FIXTURE_VENDOR_ID,
  issueLegacyJwt,
  seedRole,
  seedVendor,
  seedVendorRole,
} from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: auth and guards', () => {
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

  it('POST /authentication/login returns legacy 400 envelope for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/authentication/login')
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Could not login user. Please check your credentials.',
      statusCode: '400',
    });
  });

  it('GET /user/refresh-token returns legacy 401 envelope without token', async () => {
    const response = await request(app.getHttpServer())
      .get('/user/refresh-token')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Could not refresh token. Please check your credentials.',
      statusCode: '401',
    });
  });

  it('POST /authentication/login succeeds for valid vendor credentials', async () => {
    const plainPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      username: 'auth_user',
      email: 'auth_user@example.com',
      password: passwordHash,
    });

    const response = await request(app.getHttpServer())
      .post('/authentication/login')
      .send({ email: 'auth_user@example.com', password: plainPassword })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
    });
    expect(typeof response.body.result).toBe('string');
    expect(String(response.body.result).split('.')).toHaveLength(3);
  });

  it('GET /user/refresh-token succeeds with a valid legacy token', async () => {
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      username: 'refresh_user',
      email: 'refresh_user@example.com',
      password: null,
    });
    const token = await issueLegacyJwt({
      userId: FIXTURE_VENDOR_ID.toString(),
      roles: ['USER'],
      email: 'refresh_user@example.com',
      username: 'refresh_user',
      name: 'Refresh User',
    });

    const response = await request(app.getHttpServer())
      .get('/user/refresh-token')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: {
        jwt: expect.any(String),
      },
    });
  });

  it('GET /admin/posts requires admin JWT', async () => {
    const response = await request(app.getHttpServer()).get('/admin/posts').expect(401);

    expect(response.body).toMatchObject({
      success: false,
      message: 'ERROR: Not authorised',
      statusCode: '401',
    });
  });

  it('GET /post/posts requires AP code header when no admin JWT', async () => {
    const response = await request(app.getHttpServer()).get('/post/posts').expect(401);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Not authorised',
      statusCode: '401',
    });
  });

  it('GET /post/posts accepts AP code and reaches controller/service', async () => {
    const response = await request(app.getHttpServer())
      .get('/post/posts')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '500',
    });
    expect(String(response.body.message)).toContain('Argument #1');
  });

  it('GET /admin/user succeeds with a valid ADMIN legacy JWT', async () => {
    const adminRoleId = 99;
    await seedVendor(prisma, FIXTURE_VENDOR_ID, {
      username: 'admin_user',
      email: 'admin_user@example.com',
      password: null,
    });
    await seedRole(prisma, 'ADMIN', adminRoleId);
    await seedVendorRole(prisma, FIXTURE_VENDOR_ID, adminRoleId);

    const adminToken = await issueLegacyJwt({
      userId: FIXTURE_VENDOR_ID.toString(),
      roles: ['ADMIN'],
      email: 'admin_user@example.com',
      username: 'admin_user',
      name: 'Admin User',
    });

    const response = await request(app.getHttpServer())
      .get('/admin/user')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: {
        id: FIXTURE_VENDOR_ID.toString(),
        user: {
          id: FIXTURE_VENDOR_ID.toString(),
        },
      },
    });
  });

  it('GET /role-management succeeds with a valid ADMIN legacy JWT', async () => {
    const adminToken = await issueLegacyJwt({
      userId: FIXTURE_VENDOR_ID.toString(),
      roles: ['ADMIN'],
      email: 'admin_user@example.com',
      username: 'admin_user',
      name: 'Admin User',
    });

    const response = await request(app.getHttpServer())
      .get('/role-management')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
  });

  it('GET /instagram-sync/get-access-token returns legacy error without code', async () => {
    const response = await request(app.getHttpServer())
      .get('/instagram-sync/get-access-token')
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Could not get access token. Please check your data.',
      statusCode: '400',
    });
  });
});
