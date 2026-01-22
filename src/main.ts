import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, json, urlencoded } from 'express';
import { BigIntInterceptor } from './common/big-int.interceptor';

async function bootstrap() {
  // Critical: disable Nest’s built-in bodyParser
  const app = await NestFactory.create(AppModule, { bodyParser: false });

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
    .setTitle('AutoConnect API')
    .setDescription('API documentation for AutoConnect')
    .setVersion('1.0')
    .addBearerAuth() // if you use JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
