// apify.controller.ts
import {
  Controller,
  Post,
  Res,
  HttpStatus,
  Query,
  UseGuards,
  Optional,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { ImportJobsService } from '../queue/import-jobs.service';
import { ApifyDatasetImportService } from './apify-dataset-import.service';
import { createLogger } from '../../../common/logger.util';

@Controller({
  path: ['apify', 'api/v1/apify'],
})
@UseGuards(AdminGuard)
export class ApifyController {
  private readonly logger = createLogger('apify-controller');

  constructor(
    @Optional()
    @Inject(ImportJobsService)
    private readonly importJobsService: ImportJobsService | null,
    private readonly apifyImportService: ApifyDatasetImportService,
  ) {}

  @Post('import')
  async importFromApifyNotification(
    @Query('useOpenAI') useOpenAI: string | undefined,
    @Query('downloadImages') downloadImages: string | undefined,
    @Query('forceDownloadImages') forceDownloadImages: string | undefined,
    @Query('forceDownloadImagesDays')
    forceDownloadImagesDays: string | undefined,
    @Res() res: Response,
  ) {
    const shouldUseOpenAI = useOpenAI === 'true' || useOpenAI === '1';
    const shouldDownloadImages =
      downloadImages === 'true' || downloadImages === '1';
    const shouldForceDownloadImages =
      forceDownloadImages === 'true' || forceDownloadImages === '1';
    const forceDownloadDays = forceDownloadImagesDays
      ? Number(forceDownloadImagesDays)
      : undefined;

    if (this.importJobsService) {
      const job = await this.importJobsService.enqueueApifyImport({
        useOpenAI: shouldUseOpenAI,
        downloadImages: shouldDownloadImages,
        forceDownloadImages: shouldForceDownloadImages,
        forceDownloadImagesDays: forceDownloadDays,
      });

      res.status(HttpStatus.ACCEPTED).json({
        ok: true,
        status: 'queued',
        jobId: job.id ?? null,
      });
      return;
    }

    res.status(HttpStatus.ACCEPTED).json({
      ok: true,
      status: 'queued-inline',
    });

    setImmediate(() => {
      this.apifyImportService
        .importLatestDataset(
          shouldUseOpenAI,
          shouldDownloadImages,
          shouldForceDownloadImages,
          forceDownloadDays,
        )
        .catch((error) => {
          this.logger.error('inline apify import failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    });
  }
}
