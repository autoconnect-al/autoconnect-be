// apify.controller.ts
import { Controller, Post, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApifyDatasetImportService } from './apify-dataset-import.service';

@Controller({
  path: 'apify',
  version: '1',
})
export class ApifyController {
  constructor(private readonly apifyImport: ApifyDatasetImportService) {}

  @Post('import')
  importFromApifyNotification(@Res() res: Response) {
    // Return immediately
    res.status(HttpStatus.ACCEPTED).json({ ok: true, status: 'queued' });

    // Kick async job
    setImmediate(() => {
      this.apifyImport.importLatestDataset().catch((err) => {
        console.error('[ApifyImport] failed:', err);
      });
    });
  }
}
