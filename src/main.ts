import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { getMediaRootPath } from './common/media-path.util';
import { createLogger } from './common/logger.util';

const defaultAllowedOrigins = [
  'https://ap.autoconnect.al',
  'https://www.autoconnect.al',
  'https://autoconnect.al',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

function getAllowedCorsOrigins(): string[] {
  const fromEnv = String(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const merged = new Set<string>([...defaultAllowedOrigins, ...fromEnv]);
  return Array.from(merged);
}

async function bootstrap() {
  const logger = createLogger('http-access');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const allowedOrigins = getAllowedCorsOrigins();
  const strictCors = String(process.env.CORS_STRICT ?? '').toLowerCase() === 'true';

  app.use(express.json({ limit: '10mb' }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    }),
  );

  app.enableCors({
    origin: strictCors
      ? (origin, callback) => {
          // Allow non-browser calls (no Origin header).
          if (!origin) {
            callback(null, true);
            return;
          }
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`CORS origin not allowed: ${origin}`), false);
        }
      : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'X-Http-Authorization',
      'Content-Type',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-Admin-Code',
    ],
    exposedHeaders: ['Authorization'],
    maxAge: 3600,
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.info('request.finished', {
        method: req.method,
        path: req.originalUrl ?? req.url,
        status: res.statusCode,
        durationMs,
      });
    });
    next();
  });

  app.use('/media', express.static(getMediaRootPath()));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
