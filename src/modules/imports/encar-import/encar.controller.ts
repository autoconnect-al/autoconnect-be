import {
  Controller,
  Post,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EncarScrapeService } from './encar-scrape.service';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { createLogger } from '../../../common/logger.util';

@Controller('encar')
@UseGuards(AdminGuard)
export class EncarController {
  private readonly logger = createLogger('encar-controller');

  constructor(private readonly encarScrapeService: EncarScrapeService) {}

  @Post('scrape')
  scrape(
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

    res.status(HttpStatus.ACCEPTED).json({ ok: true, pages: pagesNum });

    setImmediate(() => {
      this.encarScrapeService
        .scrapeAndSave({
          pages: pagesNum,
          useOpenAI: shouldUseOpenAI,
          downloadImages: shouldDownloadImages,
          forceDownloadImages: shouldForceDownloadImages,
          forceDownloadImagesDays: forceDownloadDays,
        })
        .catch((err) => {
          this.logger.error('encar scrape failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    });
  }
}
