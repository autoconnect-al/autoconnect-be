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

    let batch: any[] = [];
    let totalSeen = 0;
    let totalQueuedForSave = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const current = batch;
      batch = [];

      // same chunk pattern: Promise.all(savePost)
      await Promise.all(
        current.map((item) => this.remoteSaver.savePost(item, jwt)),
      );
      totalQueuedForSave += current.length;

      console.log(
        `[ApifyImport] saved batch size=${current.length} totalSaved=${totalQueuedForSave}`,
      );
    };

    const pipeline = chain([nodeStream, parser(), streamArray()]);

    for await (const data of pipeline as any) {
      totalSeen++;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      batch.push(data.value);

      if (batch.length >= this.CHUNK_SIZE) {
        await flush();
      }
    }

    await flush();

    console.log(
      `[ApifyImport] done. totalSeen=${totalSeen} totalSaved=${totalQueuedForSave}`,
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
