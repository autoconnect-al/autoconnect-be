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
import { generateCleanedCaption, isSold } from '../utils/caption-processor';
import { createLogger } from '../../../common/logger.util';

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
  date?: string;
  user?: { pk?: number };
  [key: string]: unknown;
};

@Injectable()
export class ApifyDatasetImportService {
  private readonly CHUNK_SIZE = 10;
  private readonly logger = createLogger('apify-dataset-import-service');

  // You can hardcode, but env is safer
  private readonly apifyDatasetUrl =
    process.env.APIFY_DATASET_URL ??
    `https://api.apify.com/v2/acts/instagram-scraper~fast-instagram-post-scraper/runs/last/dataset/items?token=${process.env.APIFY_API_TOKEN}`;

  constructor(private readonly postImportService: PostImportService) {}

  async importLatestDataset(
    useOpenAI = false,
    downloadImages = false,
    forceDownloadImages = false,
    forceDownloadImagesDays?: number,
  ) {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (process.env.SHOW_LOGS) {
      this.logger.info('starting import', { runId });
    }

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
    let batch: ApifyPost[] = [];
    let totalQueuedForSave = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const toProcess = batch;
      batch = [];

      // Process each item and save to DB
      const results = await Promise.allSettled(
        toProcess.map(async (item) => {
          // Skip non-carousel posts
          if (item['product_type'] !== 'carousel_container') {
            return 'skipped';
          }

          // Map Instagram post to our format
          const postData = this.mapInstagramPost(item);

          // Skip posts older than 3 months
          if (!isWithinThreeMonths(postData.createdTime)) {
            if (process.env.SHOW_LOGS) {
              this.logger.info('skipping old post', {
                runId,
                postId: String(postData.id),
              });
            }
            return 'skipped:old';
          }

          // Check if post is sold - PHP logic: NEW sold posts are skipped
          const postId = BigInt(postData.id);
          const existingPost = await this.postImportService.getPostState(postId);

          // If post doesn't exist (new post), check if sold
          if (!existingPost.exists || existingPost.deleted) {
            const cleanedCaption = generateCleanedCaption(
              postData.caption || '',
            );
            const soldStatus = isSold(cleanedCaption);

            if (soldStatus) {
              if (process.env.SHOW_LOGS) {
                this.logger.info('skipping new sold post', {
                  runId,
                  postId: String(postData.id),
                });
              }
              return 'skipped:sold';
            }
          }

          const vendorId = item.user?.pk || 1;

          // Save directly to DB
          return this.postImportService.importPost(
            postData,
            vendorId,
            useOpenAI,
            downloadImages,
            forceDownloadImages,
            forceDownloadImagesDays,
          );
        }),
      );

      toProcess.forEach((item) => {
        if (item.pk) idsSeen.add(item.pk);
      });

      totalQueuedForSave += toProcess.length;
      if (process.env.SHOW_LOGS) {
        this.logger.info('flushed batch', {
          runId,
          totalSeen: idsSeen.size,
          totalQueuedForSave,
        });
      }
      return results;
    };

    const pipeline = chain([nodeStream, parser(), streamArray()]);

    type StreamData = { value: ApifyPost };
    for await (const data of pipeline as AsyncIterable<StreamData>) {
      batch.push(data.value);

      if (batch.length >= this.CHUNK_SIZE) {
        await flush();
      }
    }

    await flush();
    if (process.env.SHOW_LOGS) {
      this.logger.info('import done', {
        runId,
        totalSeen: idsSeen.size,
        totalSaved: totalQueuedForSave,
      });
    }
  }

  private mapInstagramPost(post: ApifyPost): ImportPostData {
    // Determine timestamp - try multiple fields that Apify might provide
    // taken_at is Unix timestamp in seconds
    // date might be milliseconds or seconds
    let createdTimeStr: string;
    if (post.date) {
      // If date is in milliseconds, convert to seconds
      const dateValue = new Date(post['date']).getTime() / 1000;
      if (dateValue > 10000000000) {
        // Looks like milliseconds
        createdTimeStr = (dateValue / 1000).toString();
      } else {
        createdTimeStr = dateValue.toString();
      }
    } else {
      // Fallback: use current time if no timestamp available
      // This ensures the post is not filtered out by date checks
      createdTimeStr = Math.floor(Date.now() / 1000).toString();
      if (process.env.SHOW_LOGS) {
        this.logger.warn('post has no timestamp; using current time', {
          postId: post.pk ?? null,
        });
      }
    }

    // Create properly typed import data
    return {
      id: post.pk ?? 0,
      createdTime: createdTimeStr,
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
