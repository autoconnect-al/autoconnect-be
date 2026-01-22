import { Module } from '@nestjs/common';
import { ApifyImportController } from './apify-import/apify-import.controller';
import { ApifyImportService } from './apify-import/apify-import.service';
import { EncarController } from './encar-import/encar.controller';
import { EncarScrapeService } from './encar-import/encar-scrape.service';
import { RemotePostSaverService } from './remote-post-saver.service';

@Module({
  controllers: [ApifyImportController, EncarController],
  providers: [ApifyImportService, EncarScrapeService, RemotePostSaverService],
})
export class IngestModule {}
