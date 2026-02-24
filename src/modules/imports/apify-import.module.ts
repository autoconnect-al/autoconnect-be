// ingest.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ApifyController } from './apify-import/apify-import.controller';
import { ApifyDatasetImportService } from './apify-import/apify-dataset-import.service';
import { RemotePostSaverService } from './remote-post-saver.service';
import { EncarController } from './encar-import/encar.controller';
import { EncarScrapeService } from './encar-import/encar-scrape.service';
import { PostImportService } from './services/post-import.service';
import { OpenAIService } from './services/openai.service';
import { ImageDownloadService } from './services/image-download.service';
import { DatabaseModule } from '../../database/database.module';
import { PostController } from './post.controller';
import {
  IMPORTS_DEAD_LETTER_QUEUE,
  IMPORTS_QUEUE,
} from './queue/import-jobs.constants';
import { ImportJobsService } from './queue/import-jobs.service';
import { ImportJobsProcessor } from './queue/import-jobs.processor';

const queueEnabled =
  String(process.env.IMPORT_QUEUE_ENABLED ?? 'false').toLowerCase() === 'true';

@Module({
  imports: [
    DatabaseModule,
    ...(queueEnabled
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST ?? '127.0.0.1',
              port: Number(process.env.REDIS_PORT ?? 6379),
              password: process.env.REDIS_PASSWORD || undefined,
              db: Number(process.env.REDIS_DB ?? 0),
            },
          }),
          BullModule.registerQueue(
            { name: IMPORTS_QUEUE },
            { name: IMPORTS_DEAD_LETTER_QUEUE },
          ),
        ]
      : []),
  ],
  controllers: [ApifyController, EncarController, PostController],
  providers: [
    ApifyDatasetImportService,
    RemotePostSaverService,
    EncarScrapeService,
    PostImportService,
    OpenAIService,
    ImageDownloadService,
    ...(queueEnabled ? [ImportJobsService, ImportJobsProcessor] : []),
  ],
})
export class IngestModule {}
