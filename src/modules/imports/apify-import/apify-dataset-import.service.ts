// apify-dataset-import.service.ts
import { Injectable } from '@nestjs/common';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Readable } from 'stream';
import { RemotePostSaverService } from '../remote-post-saver.service';

@Injectable()
export class ApifyDatasetImportService {
  private readonly CHUNK_SIZE = 10;

  // You can hardcode, but env is safer
  private readonly apifyDatasetUrl =
    process.env.APIFY_DATASET_URL ??
    `https://api.apify.com/v2/acts/instagram-scraper~fast-instagram-post-scraper/runs/last/dataset/items?token=${process.env.APIFY_API_TOKEN}`;

  private batch: any[] = [];
  private totalSeen = 0;
  private totalQueuedForSave = 0;

  constructor(private readonly remoteSaver: RemotePostSaverService) {}

  async importLatestDataset() {
    console.log('[ApifyImport] starting import from dataset URL');

    // 1) Get JWT once, reuse for all saves (same as before)
    const jwt = await this.remoteSaver.getJwt();

    // 2) Fetch dataset items (JSON array)
    const resp = await fetch(this.apifyDatasetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Apify dataset fetch failed: ${resp.status} ${resp.statusText} ${text}`,
      );
    }

    // 3) Stream parse JSON array items
    // Node 18+ has WHATWG ReadableStream on resp.body; convert to Node stream:
    const nodeStream = this.toNodeReadable(resp.body);
    if (!nodeStream) throw new Error('Apify response body is empty');
    const idsSeen = new Set<number>();

    const flush = async () => {
      if (this.batch.length === 0) return;
      // same chunk pattern: Promise.all(savePost)
      const responses = await Promise.all(
        this.batch.map((item) => this.remoteSaver.savePost(item, jwt)),
      );

      this.batch.forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        idsSeen.add(item.pk);
      });

      this.totalQueuedForSave += this.batch.length;
      this.batch = [];
      return responses;
    };

    const pipeline = chain([nodeStream, parser(), streamArray()]);

    for await (const data of pipeline as any) {
      this.totalSeen++;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.batch.push(data.value);

      if (this.batch.length >= this.CHUNK_SIZE) {
        await flush();
      }
    }

    await flush();

    console.log(
      `[ApifyImport] done. totalSeen=${idsSeen.size} totalSaved=${this.totalQueuedForSave}`,
    );
  }

  /**
   * Converts WHATWG ReadableStream (from fetch) to Node.js Readable
   */
  private toNodeReadable(body: any): Readable | null {
    if (!body) return null;

    // Node 18+ supports Readable.fromWeb

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const anyReadable: any = Readable as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof anyReadable.fromWeb === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      return anyReadable.fromWeb(body);
    }

    // Fallback: if it's already a Node stream
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof body.pipe === 'function') return body as Readable;

    throw new Error(
      'Unsupported response body stream type (need Node 18+ or polyfill)',
    );
  }
}
