// ingest.module.ts
import { Module } from '@nestjs/common';
import { ApifyController } from './apify-import/apify-import.controller';
import { ApifyDatasetImportService } from './apify-import/apify-dataset-import.service';
import { RemotePostSaverService } from './remote-post-saver.service';
import { EncarController } from './encar-import/encar.controller';
import { EncarScrapeService } from './encar-import/encar-scrape.service';
import { PostImportService } from './services/post-import.service';
import { OpenAIService } from './services/openai.service';
import { ImageDownloadService } from './services/image-download.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ApifyController, EncarController],
  providers: [
    ApifyDatasetImportService,
    RemotePostSaverService,
    EncarScrapeService,
    PostImportService,
    OpenAIService,
    ImageDownloadService,
  ],
})
export class IngestModule {}
