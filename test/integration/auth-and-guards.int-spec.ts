import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import {
  disconnectDatabase,
  resetDatabase,
  runMigrationsOnce,
  waitForDatabaseReady,
} from './helpers/db-lifecycle';

jest.setTimeout(120_000);

describe('Integration: auth and guards', () => {
  let app: INestApplication;

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
