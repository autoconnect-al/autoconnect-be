import { Injectable } from '@nestjs/common';
import { RemotePostSaverService } from '../remote-post-saver.service';

// Reuse your existing scrape function file.
// Adjust import path to wherever you place your migrated `save-from-encar.ts`.
import { scrapeEncar } from './save-from-encar';

@Injectable()
export class EncarScrapeService {
  private readonly CHUNK_SIZE = 10;

  constructor(private readonly remoteSaver: RemotePostSaverService) {}

  async scrapeAndSave(opts: { pages: number }) {
    const jwt = await this.remoteSaver.getJwt();

    let page = 1;
    let remaining = opts.pages;

    while (remaining > 0) {
      remaining--;

      const resp = await scrapeEncar(page); // returns { carsToSave, hasMore, page: nextPage }
      const posts = resp.carsToSave ?? [];

      // chunk + Promise.all(savePost) same pattern
      for (let i = 0; i < posts.length; i += this.CHUNK_SIZE) {
        const chunk = posts.slice(i, i + this.CHUNK_SIZE);
        await Promise.all(chunk.map((p) => this.remoteSaver.savePost(p as any, jwt)));
      }

      if (!resp.hasMore) break;
      page = resp.page ?? (page + 1);
    }
  }
}
