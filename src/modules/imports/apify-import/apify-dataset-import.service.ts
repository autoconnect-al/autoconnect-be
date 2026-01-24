import { Injectable } from '@nestjs/common';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Readable } from 'stream';
import {
  ImportPostData,
  PostImportService,
} from '../services/post-import.service';
import { isWithinThreeMonths } from '../utils/date-filter';

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
  [key: string]: unknown;
};

@Injectable()
export class ApifyDatasetImportService {
  private readonly CHUNK_SIZE = 10;

  // You can hardcode, but env is safer
  private readonly apifyDatasetUrl =
    process.env.APIFY_DATASET_URL ??
    `https://api.apify.com/v2/acts/instagram-scraper~fast-instagram-post-scraper/runs/last/dataset/items?token=${process.env.APIFY_API_TOKEN}`;

  private batch: ApifyPost[] = [];
  private totalSeen = 0;
  private totalQueuedForSave = 0;

  constructor(private readonly postImportService: PostImportService) {}

  async importLatestDataset(useOpenAI = false, downloadImages = false) {
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

          // Skip posts older than 3 months
          if (!isWithinThreeMonths(postData.createdTime)) {
            console.log(`Skipping post ${postData.id} - older than 3 months`);
            return 'skipped:old';
          }

          const vendorId = item.user?.pk || 1;

          // Save directly to DB
          return this.postImportService.importPost(
            postData,
            vendorId,
            useOpenAI,
            downloadImages,
          );
        }),
      );

      this.batch.forEach((item) => {
        if (item.pk) idsSeen.add(item.pk);
      });

      this.totalQueuedForSave += this.batch.length;
      this.batch = [];
      console.log(
        '[ApifyImport] flushed batch, totalSeen=%d totalQueuedForSave=%d',
        idsSeen.size,
        this.totalQueuedForSave,
      );
      return results;
    };

    const pipeline = chain([nodeStream, parser(), streamArray()]);

    type StreamData = { value: ApifyPost };
    for await (const data of pipeline as AsyncIterable<StreamData>) {
      this.totalSeen++;
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

  private mapInstagramPost(post: ApifyPost): ImportPostData {
    // Create properly typed import data
    return {
      id: post.pk ?? 0,
      createdTime: post.date
        ? (new Date(post.date).getTime() / 1000).toString()
        : '',
      caption: post.caption ?? '',
      likesCount: post.like_count,
      viewsCount: post.comment_count,
      origin: 'INSTAGRAM',
      sidecarMedias: post.carousel_media
        ?.filter((m) => m.media_type === 1)
        .map((m) => ({
          id: m.pk,
          imageStandardResolutionUrl:
            m.image_versions2?.candidates?.[0]?.url ?? '',
          type: 'image' as const,
        }))
        .filter((m) => m.imageStandardResolutionUrl !== ''),
    };
  }

  /**
   * Converts WHATWG ReadableStream (from fetch) to Node.js Readable
   */
  private toNodeReadable(body: unknown): Readable | null {
    if (!body) return null;

    // Node 18+ supports Readable.fromWeb

    // Type guard for checking if Readable has fromWeb method
    interface ReadableWithFromWeb {
      fromWeb: (stream: unknown) => Readable;
    }

    const hasFromWeb = (
      r: typeof Readable,
    ): r is typeof Readable & ReadableWithFromWeb => {
      return 'fromWeb' in r && typeof r.fromWeb === 'function';
    };

    if (hasFromWeb(Readable)) {
      return Readable.fromWeb(body);
    }

    // Fallback: if it's already a Node stream
    if (
      body &&
      typeof body === 'object' &&
      'pipe' in body &&
      typeof body.pipe === 'function'
    ) {
      return body as Readable;
    }

    throw new Error(
      'Unsupported response body stream type (need Node 18+ or polyfill)',
    );
  }
}
