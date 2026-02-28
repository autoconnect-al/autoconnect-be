import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readdir, stat, unlink } from 'fs/promises';
import { extname, resolve } from 'path';
import { getMediaRootPath } from '../../common/media-path.util';
import { createLogger } from '../../common/logger.util';
import { ApPostToolingService } from './ap-post-tooling.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.avif',
  '.heic',
  '.heif',
]);

@Injectable()
export class ApMaintenanceCronService {
  private readonly logger = createLogger('ap-maintenance-cron-service');
  private readonly mediaTmpRoot = resolve(getMediaRootPath(), 'tmp');

  constructor(private readonly apPostToolingService: ApPostToolingService) {}

  @Cron('0 0 * * *')
  async runAutoRenewAtMidnight(): Promise<void> {
    try {
      const response = await this.apPostToolingService.autoRenewPosts();
      this.logger.info('cron.auto-renew.completed', {
        success: response.success,
        statusCode: response.statusCode,
        message: response.message,
      });
    } catch (error) {
      this.logger.error('cron.auto-renew.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @Cron('0 0 * * *')
  async cleanupTmpImagesAtMidnight(): Promise<void> {
    const nowMs = Date.now();
    let scanned = 0;
    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const entries = await readdir(this.mediaTmpRoot, { withFileTypes: true });

      for (const entry of entries) {
        scanned += 1;

        if (!entry.isFile()) {
          skipped += 1;
          continue;
        }

        const extension = extname(entry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(extension)) {
          skipped += 1;
          continue;
        }

        const filePath = resolve(this.mediaTmpRoot, entry.name);

        try {
          const fileStats = await stat(filePath);
          const ageMs = nowMs - fileStats.mtimeMs;
          if (ageMs <= ONE_DAY_MS) {
            skipped += 1;
            continue;
          }

          await unlink(filePath);
          deleted += 1;
        } catch (error) {
          errors += 1;
          this.logger.warn('cron.tmp-cleanup.file-error', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('cron.tmp-cleanup.completed', {
        tmpRoot: this.mediaTmpRoot,
        scanned,
        deleted,
        skipped,
        errors,
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        this.logger.info('cron.tmp-cleanup.skip-missing-root', {
          tmpRoot: this.mediaTmpRoot,
        });
        return;
      }

      this.logger.error('cron.tmp-cleanup.failed', {
        tmpRoot: this.mediaTmpRoot,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
