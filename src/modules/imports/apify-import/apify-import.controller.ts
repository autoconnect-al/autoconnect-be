import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ApifyImportService } from './apify-import.service';

@Controller('apify')
export class ApifyImportController {
  constructor(private readonly apifyImportService: ApifyImportService) {}

  @Post('import')
  async import(@Req() req: Request, @Res() res: Response) {
    const tempDir = path.join(process.cwd(), 'tmp', 'apify');
    await mkdir(tempDir, { recursive: true });

    const importId = randomUUID();
    const filePath = path.join(tempDir, `apify-${importId}.json`);

    // Save raw request body to disk (no JSON parsing)
    await pipeline(req, createWriteStream(filePath, { flags: 'wx' }));

    // Return immediately
    res.status(HttpStatus.ACCEPTED).json({ ok: true, importId });

    // Async processing
    setImmediate(() => {
      this.apifyImportService
        .processApifyFile(filePath, { importId })
        .catch((err) => {
          console.error(`[ApifyImport] failed importId=${importId}`, err);
        });
    });
  }
}
