import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/sitemap/data (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/sitemap/data');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });

  afterEach(async () => {
    await app.close();
  });
});
