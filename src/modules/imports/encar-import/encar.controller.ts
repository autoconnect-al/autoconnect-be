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

@Controller('encar')
@UseGuards(AdminGuard)
export class EncarController {
  constructor(private readonly encarScrapeService: EncarScrapeService) {}

  @Post('scrape')
  scrape(
    @Query('pages') pages = '1',
    @Query('useOpenAI') useOpenAI: string | undefined,
    @Res() res: Response,
  ) {
    const pagesNum = Math.max(1, Number(pages) || 1);
    const shouldUseOpenAI = useOpenAI === 'true' || useOpenAI === '1';

    res.status(HttpStatus.ACCEPTED).json({ ok: true, pages: pagesNum });

    setImmediate(() => {
      this.encarScrapeService
        .scrapeAndSave({ pages: pagesNum, useOpenAI: shouldUseOpenAI })
        .catch((err) => {
          console.error('[EncarScrape] failed', err);
        });
    });
  }
}
