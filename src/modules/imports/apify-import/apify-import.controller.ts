// apify.controller.ts
import {
  Controller,
  Post,
  Res,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApifyDatasetImportService } from './apify-dataset-import.service';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { createLogger } from '../../../common/logger.util';

@Controller({
  path: ['apify', 'api/v1/apify'],
})
@UseGuards(AdminGuard)
export class ApifyController {
  private readonly logger = createLogger('apify-import-controller');

  constructor(private readonly apifyImport: ApifyDatasetImportService) {}

  @Post('import')
  importFromApifyNotification(
    @Query('useOpenAI') useOpenAI: string | undefined,
    @Query('downloadImages') downloadImages: string | undefined,
    @Query('forceDownloadImages') forceDownloadImages: string | undefined,
    @Query('forceDownloadImagesDays')
    forceDownloadImagesDays: string | undefined,
    @Res() res: Response,
  ) {
    // Return immediately
    res.status(HttpStatus.ACCEPTED).json({ ok: true, status: 'queued' });

    // Kick async job
    const shouldUseOpenAI = useOpenAI === 'true' || useOpenAI === '1';
    const shouldDownloadImages =
      downloadImages === 'true' || downloadImages === '1';
    const shouldForceDownloadImages =
      forceDownloadImages === 'true' || forceDownloadImages === '1';
    const forceDownloadDays = forceDownloadImagesDays
      ? Number(forceDownloadImagesDays)
      : undefined;

    setImmediate(() => {
      this.apifyImport
        .importLatestDataset(
          shouldUseOpenAI,
          shouldDownloadImages,
          shouldForceDownloadImages,
          forceDownloadDays,
        )
        .catch((err) => {
          this.logger.error('import failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    });
  }
}
