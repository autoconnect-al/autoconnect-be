// apify-dataset-import.service.ts
import { Injectable } from '@nestjs/common';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Readable } from 'stream';
import { PostImportService } from '../services/post-import.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-assignment
const PostModel = require('../types/instagram').PostModel;

type ApifyPost = {
  pk?: number;
  caption?: string;
  like_count?: number;
  comment_count?: number;
  carousel_media?: Array<{
    pk: number;
    media_type: number;
    image_versions2?: { candidates?: { url?: string }[] };
  }>;
  product_type?: string;
  date?: number;
  taken_at?: number;
  user?: { pk?: number };
  [key: string]: any;
};

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

  constructor(private readonly postImportService: PostImportService) {}

  async importLatestDataset(useOpenAI = false) {
    console.log('[ApifyImport] starting import from dataset URL');

    // 1) Fetch dataset items (JSON array)
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

    // 2) Stream parse JSON array items
    // Node 18+ has WHATWG ReadableStream on resp.body; convert to Node stream:
    const nodeStream = this.toNodeReadable(resp.body);
    if (!nodeStream) throw new Error('Apify response body is empty');
    const idsSeen = new Set<number>();

    const flush = async () => {
      if (this.batch.length === 0) return;
      // Process each item and save to DB
      const results = await Promise.allSettled(
        this.batch.map(async (item) => {
          // Skip non-carousel posts
          if (item['product_type'] !== 'carousel_container') {
            return 'skipped';
          }

          // Map Instagram post to our format
          const postData = this.mapInstagramPost(item);
          const vendorId = item.user?.pk || 1;

          // Save directly to DB
          return this.postImportService.importPost(
            postData,
            vendorId,
            useOpenAI,
          );
        }),
      );

      this.batch.forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        if (item.pk) idsSeen.add(item.pk);
      });

      this.totalQueuedForSave += this.batch.length;
      this.batch = [];
      return results;
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

  private mapInstagramPost(post: ApifyPost): any {
    const postData = JSON.parse(JSON.stringify(PostModel));
    postData.id = post.pk;
    postData.createdTime = post.date
      ? (new Date(post.date).getTime() / 1000).toString()
      : '';
    postData.caption = post.caption ?? '';
    postData.likesCount = post.like_count;
    postData.commentsCount = post.comment_count;
    postData.origin = 'INSTAGRAM';

    postData.sidecarMedias = post.carousel_media
      ?.filter((m) => m.media_type === 1)
      .map((m) => ({
        id: m.pk,
        imageStandardResolutionUrl:
          m.image_versions2?.candidates?.[0]?.url ?? '',
        type: 'image',
      }))
      .filter(
        (m: { imageStandardResolutionUrl: string }) =>
          m.imageStandardResolutionUrl !== '',
      );

    return postData;
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
