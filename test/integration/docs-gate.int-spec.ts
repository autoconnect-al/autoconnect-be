import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import {
  disconnectDatabase,
  runMigrationsOnce,
  waitForDatabaseReady,
} from './helpers/db-lifecycle';

jest.setTimeout(120_000);

describe('Integration: legacy-docs gate', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await disconnectDatabase();
  });

  it('GET /openapi.json returns 404 without docs token', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Not found',
    });
  });

  it('GET /openapi.json returns openapi payload with valid docs token header', async () => {
    const response = await request(app.getHttpServer())
      .get('/openapi.json')
      .set('x-docs-token', 'integration-docs-code')
      .expect(200);

    expect(response.body).toMatchObject({
      openapi: expect.any(String),
      info: expect.any(Object),
      paths: expect.any(Object),
    });
    expect(response.body.paths).toHaveProperty('/car-details/search');
  });

  it('GET /docs is guarded by token and returns docs metadata when authorized', async () => {
    await request(app.getHttpServer())
      .get('/docs')
      .set('x-docs-token', 'wrong-code')
      .expect(404);

    const response = await request(app.getHttpServer())
      .get('/docs')
      .set('x-docs-token', 'integration-docs-code')
      .expect(200);

    expect(response.body).toMatchObject({
      docs: 'openapi',
      url: '/openapi.json',
      authHeader: 'X-Docs-Token',
    });
  });
});
