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

describe('Integration: data upload-image negative paths', () => {
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

  it('POST /data/upload-image rejects remote URL input', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/upload-image')
      .send({
        file: 'https://example.com/image.jpg',
        id: 'upload-remote',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Unsupported image source. Use multipart file or data URI.',
    });
  });

  it('POST /data/upload-image rejects local path input', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/upload-image')
      .send({
        file: '/etc/passwd',
        id: 'upload-local',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Unsupported image source. Use multipart file or data URI.',
    });
  });

  it('POST /data/upload-image rejects unsupported data URI mime type', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/upload-image')
      .send({
        file: 'data:text/plain;base64,SGVsbG8=',
        id: 'upload-text-mime',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Unsupported image source. Use multipart file or data URI.',
    });
  });

  it('POST /data/upload-image rejects invalid image payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/data/upload-image')
      .send({
        file: 'data:image/png;base64,SGVsbG8=',
        id: 'upload-invalid-image',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Invalid image payload.',
    });
  });

  it('POST /data/upload-image rejects multipart uploads exceeding size limit', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const response = await request(app.getHttpServer())
      .post('/data/upload-image')
      .field('file', 'placeholder')
      .field('id', 'oversized-upload')
      .attach('asset', oversized, {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Image exceeds max size limit.',
    });
  });
});
