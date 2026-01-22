// ingest.module.ts
import { Module } from '@nestjs/common';
import { ApifyController } from './apify-import/apify-import.controller';
import { ApifyDatasetImportService } from './apify-import/apify-dataset-import.service';
import { RemotePostSaverService } from './remote-post-saver.service';

@Module({
  controllers: [ApifyController],
  providers: [ApifyDatasetImportService, RemotePostSaverService],
})
export class IngestModule {}
