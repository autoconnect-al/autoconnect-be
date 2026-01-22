import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { unlink } from 'fs/promises';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { RemotePostSaverService } from '../remote-post-saver.service';

@Injectable()
export class ApifyImportService {
  private readonly CHUNK_SIZE = 10; // same as your script

  constructor(private readonly remoteSaver: RemotePostSaverService) {}

  /**
   * Reads a JSON object from disk that looks like:
   * { "eventData": [ ...items... ], ... }
   * Streams eventData array items and uploads them like save-post.ts (login + chunk + Promise.all(savePost)).
   */
  async processApifyFile(filePath: string, meta?: { importId?: string }) {
    const importId = meta?.importId;
    console.log(`[ApifyImport] start importId=${importId}`);

    const jwt = await this.remoteSaver.getJwt();

    let batch: any[] = [];
    let totalSeen = 0;
    let totalSaved = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const current = batch;
      batch = [];

      const requests = current.map((post) => this.remoteSaver.savePost(post, jwt));
      try {
        await Promise.all(requests); // same as your script per chunk
        totalSaved += current.length;
      } catch (e) {
        // your script logs and continues
        console.error(`[ApifyImport] chunk error importId=${importId}`, e);
      }
    };

    try {
      const pipeline = chain([
        fs.createReadStream(filePath),
        parser(),
        pick({ filter: 'eventData' }), // <-- key difference: eventData lives inside request body
        streamArray(),
      ]);

      for await (const data of pipeline as any) {
        totalSeen++;
        batch.push(data.value);

        if (batch.length >= this.CHUNK_SIZE) {
          await flush();
        }
      }

      await flush();

      console.log(
        `[ApifyImport] done importId=${importId} totalSeen=${totalSeen} totalSaved=${totalSaved}`,
      );
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  }
}
