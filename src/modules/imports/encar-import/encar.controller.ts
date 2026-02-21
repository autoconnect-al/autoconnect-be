import {
  Controller,
  Post,
  Query,
  Res,
  HttpStatus,
  UseGuards,
  Optional,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { ImportJobsService } from '../queue/import-jobs.service';
import { EncarScrapeService } from './encar-scrape.service';
import { createLogger } from '../../../common/logger.util';

@Controller('encar')
@UseGuards(AdminGuard)
export class EncarController {
  private readonly logger = createLogger('encar-controller');

  constructor(
    @Optional()
    @Inject(ImportJobsService)
    private readonly importJobsService: ImportJobsService | null,
    private readonly encarScrapeService: EncarScrapeService,
  ) {}

  @Post('scrape')
  async scrape(
    @Query('pages') pages = '1',
    @Query('useOpenAI') useOpenAI: string | undefined,
    @Query('downloadImages') downloadImages: string | undefined,
    @Query('forceDownloadImages') forceDownloadImages: string | undefined,
    @Query('forceDownloadImagesDays')
    forceDownloadImagesDays: string | undefined,
    @Res() res: Response,
  ) {
    const pagesNum = Math.max(1, Number(pages) || 1);
    const shouldUseOpenAI = useOpenAI === 'true' || useOpenAI === '1';
    const shouldDownloadImages =
      downloadImages === 'true' || downloadImages === '1';
    const shouldForceDownloadImages =
      forceDownloadImages === 'true' || forceDownloadImages === '1';
    const forceDownloadDays = forceDownloadImagesDays
      ? Number(forceDownloadImagesDays)
      : undefined;

    if (this.importJobsService) {
      const job = await this.importJobsService.enqueueEncarScrape({
        pages: pagesNum,
        useOpenAI: shouldUseOpenAI,
        downloadImages: shouldDownloadImages,
        forceDownloadImages: shouldForceDownloadImages,
        forceDownloadImagesDays: forceDownloadDays,
      });

      res.status(HttpStatus.ACCEPTED).json({
        ok: true,
        pages: pagesNum,
        status: 'queued',
        jobId: job.id ?? null,
      });
      return;
    }

    res.status(HttpStatus.ACCEPTED).json({
      ok: true,
      pages: pagesNum,
      status: 'queued-inline',
    });

    setImmediate(() => {
      this.encarScrapeService
        .scrapeAndSave({
          pages: pagesNum,
          useOpenAI: shouldUseOpenAI,
          downloadImages: shouldDownloadImages,
          forceDownloadImages: shouldForceDownloadImages,
          forceDownloadImagesDays: forceDownloadDays,
        })
        .catch((error) => {
          this.logger.error('inline encar scrape failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    });
  }
}
