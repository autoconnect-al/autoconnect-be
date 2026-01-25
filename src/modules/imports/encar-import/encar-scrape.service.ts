import { Injectable } from '@nestjs/common';
import { PostImportService } from '../services/post-import.service';
import { isWithinThreeMonths } from '../utils/date-filter';

// Reuse your existing scrape function file.
// Adjust import path to wherever you place your migrated `save-from-encar.ts`.
import { scrapeEncar } from './save-from-encar';

@Injectable()
export class EncarScrapeService {
  private readonly CHUNK_SIZE = 10;

  constructor(private readonly postImportService: PostImportService) {}

  async scrapeAndSave(opts: {
    pages: number;
    useOpenAI?: boolean;
    downloadImages?: boolean;
    forceDownloadImages?: boolean;
  }) {
    let page = 1;
    let remaining = opts.pages;

    while (remaining > 0) {
      remaining--;

      const resp = await scrapeEncar(page); // returns { carsToSave, hasMore, page: nextPage }
      const posts = resp.carsToSave ?? [];

      // chunk + Promise.allSettled for better error handling
      for (let i = 0; i < posts.length; i += this.CHUNK_SIZE) {
        const chunk = posts.slice(i, i + this.CHUNK_SIZE);
        await Promise.allSettled(
          chunk.map((p: any) => {
            // Skip posts older than 3 months
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            if (!isWithinThreeMonths(p.createdTime)) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              console.log(`Skipping Encar post ${p.id} - older than 3 months`);
              return Promise.resolve('skipped:old');
            }

            // Extract vendor ID (default to 1 for Encar)
            const vendorId = 1; // Could be made configurable
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return this.postImportService.importPost(
              p,
              vendorId,
              opts.useOpenAI || false,
              opts.downloadImages || false,
              opts.forceDownloadImages || false,
            );
          }),
        );
      }

      if (!resp.hasMore) break;
      page = resp.page ?? page + 1;
    }
  }
}
