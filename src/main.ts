import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, json, urlencoded } from 'express';
import { BigIntInterceptor } from './common/big-int.interceptor';

async function bootstrap() {
  // Critical: disable Nest’s built-in bodyParser
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Enable CORS for all routes
  app.enableCors({
    origin: true, // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    maxAge: 3600,
  });

  // Re-enable JSON parsing for "normal" routes.
  // IMPORTANT: do not apply this to /imports/apify (our streaming endpoint).
  app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith('/imports/apify')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
      return next();
    }
    return json({ limit: '2mb' })(req, res, next); // tune limit for normal APIs
  });

  // Optionally also enable urlencoded for normal routes
  app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith('/imports/apify')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
      return next();
    }
    return urlencoded({ extended: true, limit: '2mb' })(req, res, next);
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // main.ts
  app.useGlobalInterceptors(new BigIntInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Vehicle API')
    .setDescription(
      'Comprehensive API for vehicle search, vendor management, authentication, and data import.',
    )
    .setVersion('1.0.0')
    .setContact(
      'Support',
      'https://github.com/reipano/vehicle-api',
      'support@example.com',
    )
    .setLicense('UNLICENSED', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Health check and system status endpoints')
    .addTag('Auth', 'Authentication endpoints for login and password reset')
    .addTag('Search', 'Search and filtering endpoints for vehicles')
    .addTag('Vendor', 'Vendor management endpoints')
    .addTag('Imports', 'Data import and synchronization endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
