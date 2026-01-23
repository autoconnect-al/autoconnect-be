// apify.controller.ts
import { Controller, Post, Res, HttpStatus, Query, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApifyDatasetImportService } from './apify-dataset-import.service';
import { AdminGuard } from '../../../common/guards/admin.guard';

@Controller({
  path: 'apify',
  version: '1',
})
@UseGuards(AdminGuard)
export class ApifyController {
  constructor(private readonly apifyImport: ApifyDatasetImportService) {}

  @Post('import')
  importFromApifyNotification(
    @Query('useOpenAI') useOpenAI: string | undefined,
    @Res() res: Response,
  ) {
    // Return immediately
    res.status(HttpStatus.ACCEPTED).json({ ok: true, status: 'queued' });

    // Kick async job
    const shouldUseOpenAI = useOpenAI === 'true' || useOpenAI === '1';
    setImmediate(() => {
      this.apifyImport.importLatestDataset(shouldUseOpenAI).catch((err) => {
        console.error('[ApifyImport] failed:', err);
      });
    });
  }
}
