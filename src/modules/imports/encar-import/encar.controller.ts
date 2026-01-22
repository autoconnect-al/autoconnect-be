import { Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { EncarScrapeService } from './encar-scrape.service';

@Controller('encar')
export class EncarController {
  constructor(private readonly encarScrapeService: EncarScrapeService) {}

  @Post('scrape')
  scrape(@Query('pages') pages = '1', @Res() res: Response) {
    const pagesNum = Math.max(1, Number(pages) || 1);

    res.status(HttpStatus.ACCEPTED).json({ ok: true, pages: pagesNum });

    setImmediate(() => {
      this.encarScrapeService
        .scrapeAndSave({ pages: pagesNum })
        .catch((err) => {
          console.error('[EncarScrape] failed', err);
        });
    });
  }
}
