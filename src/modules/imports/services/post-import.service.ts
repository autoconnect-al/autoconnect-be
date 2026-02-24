import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  generateCleanedCaption,
  encodeCaption,
  isSold,
  isCustomsPaid,
} from '../utils/caption-processor';
import { OpenAIService, CarDetailFromAI } from './openai.service';
import { ImageDownloadService } from './image-download.service';
import { isWithinThreeMonths, isWithinDays } from '../utils/date-filter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { sanitizePostUpdateDataForSource } from '../../../common/promotion-field-guard.util';
import { createLogger } from '../../../common/logger.util';

export interface ImportPostData {
  id: number | string;
  caption?: string;
  createdTime?: string;
  likesCount?: number;
  viewsCount?: number;
  sidecarMedias?:
    | Array<{
        id: number | string;
        imageStandardResolutionUrl: string;
        type: 'image' | 'video';
      }>
    | string;
  origin?: string; // 'INSTAGRAM', 'ENCAR', etc.
  cardDetails?: {
    make?: string;
    model?: string;
    variant?: string;
    registration?: number;
    mileage?: number;
    transmission?: string;
    fuelType?: string;
    engine?: string | number;
    bodyType?: string;
    price?: number;
    drivetrain?: string;
    seats?: number;
    numberOfDoors?: number;
    customsPaid?: boolean;
    contact?: Prisma.JsonValue;
    vin?: string;
    options?: string;
  };
}

export interface ParsedResult {
  id: string | number;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  registration?: string | number | null;
  mileage?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  engineSize?: string | null;
  drivetrain?: string | null;
  seats?: number | null;
  numberOfDoors?: number | null;
  bodyType?: string | null;
  price?: number | null;
  emissionGroup?: string | null;
  sold?: boolean | null;
  customsPaid?: boolean | null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  contact?: unknown | null;
  type?: string | null;
  priceVerified?: boolean | null;
  mileageVerified?: boolean | null;
  fuelVerified?: boolean | null;
  // Post fields
  status?: string | null;
  origin?: string | null;
  renewTo?: number | null;
  highlightedTo?: number | null;
  promotionTo?: number | null;
  mostWantedTo?: number | null;
}

type IncrementMetric =
  | 'postOpen'
  | 'impressions'
  | 'reach'
  | 'clicks'
  | 'contact';
type ContactMethod = 'call' | 'whatsapp' | 'email' | 'instagram';

interface IncrementMetricOptions {
  visitorId?: string;
  contactMethod?: ContactMethod;
}

@Injectable()
export class PostImportService {
  private readonly logger = createLogger('post-import-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly imageDownloadService: ImageDownloadService,
  ) {}

  async getPostState(postId: bigint): Promise<{ exists: boolean; deleted: boolean }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, deleted: true },
    });

    if (!post) {
      return { exists: false, deleted: false };
    }

    return { exists: true, deleted: Boolean(post.deleted) };
  }

  /**
   * Import a post with optional car details and image downloads
   * @param postData - Post data to import
   * @param vendorId - Vendor ID
   * @param useOpenAI - Whether to use OpenAI to generate car details
   * @param downloadImages - Whether to download and process images
   * @param forceDownloadImages - If true, re-download images even if they exist
   * @param forceDownloadImagesDays - If set, only force download for posts within the last X days
   * @returns Saved post ID or null if post is old and marked as deleted
   */
  async importPost(
    postData: ImportPostData,
    vendorId: number,
    useOpenAI = false,
    downloadImages = false,
    forceDownloadImages = false,
    forceDownloadImagesDays?: number,
  ): Promise<bigint | null> {
    let idempotencyKey = '';
    let payloadHash = '';
    let idempotencyClaimed = false;

    try {
      const now = new Date();
      const postId = BigInt(postData.id);
      const source =
        typeof postData.origin === 'string' && postData.origin.trim().length > 0
          ? postData.origin.trim()
          : 'UNKNOWN';
      idempotencyKey = `${source}:${postId.toString()}`;
      payloadHash = this.buildImportPayloadHash({
        postData,
        vendorId,
        useOpenAI,
        downloadImages,
        forceDownloadImages,
        forceDownloadImagesDays,
      });

      idempotencyClaimed = await this.claimImportIdempotency(
        idempotencyKey,
        payloadHash,
      );
      if (!idempotencyClaimed) {
        if (process.env.SHOW_LOGS) {
          this.logger.info('skipping replayed import payload', {
            postId: postId.toString(),
            source,
          });
        }
        return postId;
      }

      if (process.env.SHOW_LOGS) {
        this.logger.info('processing post', {
          postId: postId.toString(),
          vendorId,
          origin: postData.origin || 'N/A',
        });
      }

      // Check if post exists and if it's older than 3 months
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          createdTime: true,
          vendor_id: true,
          deleted: true,
          status: true,
          cleanedCaption: true,
          car_detail_id: true,
        },
      });

      if (existingPost && !existingPost.deleted) {
        // Check if existing post is older than 3 months
        if (!isWithinThreeMonths(existingPost.createdTime)) {
          if (process.env.SHOW_LOGS) {
            this.logger.info('post exists and is older than 3 months; deleting', {
              postId: postId.toString(),
            });
          }
          // Mark post as deleted
          await this.markPostAsDeleted(postId, existingPost.vendor_id);
          if (process.env.SHOW_LOGS) {
            this.logger.info('post marked as deleted', {
              postId: postId.toString(),
            });
          }
          await this.markImportCompleted(idempotencyKey, payloadHash);
          return null;
        }
      } else if (existingPost && existingPost.deleted) {
        if (process.env.SHOW_LOGS) {
          this.logger.info('skipping deleted post', { postId: postId.toString() });
        }
        await this.markImportCompleted(idempotencyKey, payloadHash);
        return postId;
      }

      // Process caption
      const originalCaption = postData.caption || '';
      const cleanedCaption = generateCleanedCaption(originalCaption);
      const encodedCaption = encodeCaption(originalCaption);

      // Check if sold
      const sold = isSold(cleanedCaption);
      const customsPaid = isCustomsPaid(cleanedCaption);

      // If post is sold, mark it as sold and delete images immediately without any other updates
      if (sold) {
        if (process.env.SHOW_LOGS) {
          this.logger.info('post is sold; cleaning and deleting', {
            postId: postId.toString(),
          });
        }

        if (existingPost) {
          await this.markPostAsDeleted(postId, existingPost.vendor_id);
        }

        // Update car_detail if it exists to mark as sold
        const existingCarDetail = await this.prisma.car_detail.findFirst({
          where: { post_id: postId },
        });
        if (existingCarDetail && !existingCarDetail.sold) {
          await this.prisma.car_detail.update({
            where: { id: existingCarDetail.id },
            data: { sold: true, deleted: true, dateUpdated: now },
          });
        }

        if (process.env.SHOW_LOGS) {
          this.logger.info('sold post cleaned', { postId: postId.toString() });
        }

        await this.markImportCompleted(idempotencyKey, payloadHash);
        return postId;
      }

      const existingCarDetail = await this.prisma.car_detail.findFirst({
        where: { post_id: postId },
      });

      if (existingCarDetail && existingCarDetail.sold) {
        if (process.env.SHOW_LOGS) {
          this.logger.info('car detail already sold; deleting post', {
            postId: postId.toString(),
            carDetailId: existingCarDetail.id.toString(),
          });
        }
        await this.prisma.post.update({
          where: { id: postId },
          data: { deleted: true, dateUpdated: now },
        });
        await this.prisma.car_detail.update({
          where: { id: existingCarDetail.id },
          data: { deleted: true, dateUpdated: now },
        });
      }

      // Check if vendor exists, if not create it
      await this.ensureVendorExists(BigInt(vendorId));

      // Download and process images if requested
      if (
        downloadImages &&
        postData.sidecarMedias &&
        postData.sidecarMedias.length > 0
      ) {
        try {
          if (!Array.isArray(postData.sidecarMedias)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            postData.sidecarMedias = JSON.parse(postData.sidecarMedias);
          }
          const imageUrls = (
            postData.sidecarMedias as {
              imageStandardResolutionUrl: string;
              type: string;
              id: string;
            }[]
          )
            .filter(
              (media) =>
                media.type === 'image' && media.imageStandardResolutionUrl,
            )
            .map((media) => ({
              imageUrls: media.imageStandardResolutionUrl,
              name: media.id,
            }));

          if (imageUrls.length > 0) {
            // Determine if we should force download for this post
            let shouldForceDownload = forceDownloadImages;

            // If forceDownloadImagesDays is set, only force download if post is within that period
            if (
              forceDownloadImages &&
              forceDownloadImagesDays !== undefined &&
              forceDownloadImagesDays > 0
            ) {
              shouldForceDownload = isWithinDays(
                postData.createdTime,
                forceDownloadImagesDays,
              );
              if (shouldForceDownload) {
                if (process.env.SHOW_LOGS) {
                  this.logger.info('forcing image download for fresh post', {
                    postId: String(postData.id),
                    days: forceDownloadImagesDays,
                  });
                }
              } else {
                if (process.env.SHOW_LOGS) {
                  this.logger.info(
                    'skip forced image download for older post',
                    {
                      postId: String(postData.id),
                      days: forceDownloadImagesDays,
                    },
                  );
                }
              }
            }

            const result =
              await this.imageDownloadService.downloadAndProcessImages(
                imageUrls,
                vendorId,
                postData.id,
                shouldForceDownload,
              );
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            postData.sidecarMedias = result as any;
            if (process.env.SHOW_LOGS) {
              this.logger.info('images downloaded', {
                postId: String(postData.id),
                imageCount: imageUrls.length,
                forced: shouldForceDownload,
              });
            }
          }
        } catch (error) {
          this.logger.error('failed to download images', {
            postId: String(postData.id),
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with post creation even if image download fails
        }
      }

      // Create or update post FIRST - car_detail depends on this
      const isNewPost = !existingPost || existingPost.deleted;
      let carDetailId: bigint | null = null;

      const post = await this.prisma.post.upsert({
        where: { id: postId },
        create: {
          id: postId,
          dateCreated: now,
          dateUpdated: now,
          caption: encodedCaption,
          cleanedCaption,
          createdTime: postData.createdTime || now.toISOString(),
          sidecarMedias: postData.sidecarMedias
            ? JSON.stringify(postData.sidecarMedias)
            : '[]',
          vendor_id: BigInt(vendorId),
          live: false,
          likesCount: postData.likesCount || 0,
          viewsCount: postData.viewsCount || 0,
          car_detail_id: null, // Will be set after car_detail is created
          origin: postData.origin || null,
          status: 'DRAFT',
          revalidate: false,
        },
        update: {
          dateUpdated: now,
          caption: encodedCaption,
          cleanedCaption,
          createdTime: postData.createdTime || now.toISOString(),
          sidecarMedias: postData.sidecarMedias
            ? JSON.stringify(postData.sidecarMedias)
            : '',
          likesCount: postData.likesCount || 0,
          viewsCount: postData.viewsCount || 0,
          origin: postData.origin || null,
          status: existingPost?.status ?? 'DRAFT',
          revalidate: cleanedCaption !== existingPost?.cleanedCaption,
        },
      });

      if (process.env.SHOW_LOGS) {
        this.logger.info('post revalidation status', {
          postId: postId.toString(),
          revalidate: post.revalidate,
          newCaption: cleanedCaption,
          existingCaption: existingPost?.cleanedCaption || 'N/A',
        });
      }
      if (process.env.SHOW_LOGS) {
        this.logger.info('post persisted', {
          postId: postId.toString(),
          vendorId,
          origin: postData.origin || 'N/A',
          isNewPost,
          sold,
          customsPaid,
        });
      }

      // Keep customsPaid in sync for existing posts.
      // This allows re-imports to overwrite previous values, including setting null.
      if (existingPost) {
        if (existingPost.car_detail_id) {
          await this.prisma.car_detail.updateMany({
            where: { id: existingPost.car_detail_id },
            data: { customsPaid, dateUpdated: now },
          });
        }
      }

      // Now create/link car_detail AFTER post exists
      // For existing posts (Instagram or Encar), preserve car_detail - assume user data is complete
      if (existingPost) {
        // Reuse existing car_detail ID for any existing post
        carDetailId = existingPost.car_detail_id;
      } else if (postData.origin === 'ENCAR' && postData.cardDetails) {
        // Encar: create car_detail from provided data (only for new posts)
        carDetailId = await this.createCarDetail(
          postData.cardDetails,
          sold,
          customsPaid,
          now,
          postId,
        );
      } else if (postData.origin === 'INSTAGRAM' && isNewPost) {
        // New Instagram post: create empty car_detail or use OpenAI
        let carDetailsFromAI: CarDetailFromAI | null = null;

        if (useOpenAI && cleanedCaption) {
          if (process.env.SHOW_LOGS) {
            this.logger.info('generating details with openai', {
              postId: postId.toString(),
            });
          }
          carDetailsFromAI =
            await this.openaiService.generateCarDetails(cleanedCaption);
        }

        if (carDetailsFromAI && Object.keys(carDetailsFromAI).length > 0) {
          if (process.env.SHOW_LOGS) {
            this.logger.info('openai generated details', {
              postId: postId.toString(),
            });
          }
          // Create car_detail from AI-generated data
          // Convert AI format to cardDetails format
          const aiAsCardDetails: ImportPostData['cardDetails'] = {
            make: carDetailsFromAI.make,
            model: carDetailsFromAI.model,
            variant: carDetailsFromAI.variant,
            registration: carDetailsFromAI.registration,
            mileage: carDetailsFromAI.mileage,
            transmission: carDetailsFromAI.transmission,
            fuelType: carDetailsFromAI.fuelType,
            engine: carDetailsFromAI.engineSize,
            bodyType: carDetailsFromAI.bodyType,
            price: carDetailsFromAI.price,
            drivetrain: carDetailsFromAI.drivetrain,
          };
          carDetailId = await this.createCarDetail(
            aiAsCardDetails,
            sold,
            customsPaid,
            now,
            postId,
          );
        } else {
          if (useOpenAI) {
            if (process.env.SHOW_LOGS) {
              this.logger.warn('openai returned empty details; creating empty', {
                postId: postId.toString(),
              });
            }
          }
          // Create empty car_detail
          carDetailId = await this.createEmptyCarDetail(
            sold,
            customsPaid,
            now,
            postId,
          );
        }
      } else if (postData.cardDetails && isNewPost) {
        // Other sources with car details
        carDetailId = await this.createCarDetail(
          postData.cardDetails,
          sold,
          customsPaid,
          now,
          postId,
        );
      }

      if (carDetailId) {
        await this.prisma.car_detail.updateMany({
          where: {
            id: carDetailId,
            OR: [{ post_id: null }, { post_id: { not: postId } }],
          },
          data: { post_id: postId },
        });
      }

      // Update post with car_detail_id if a car_detail was created
      if (carDetailId && isNewPost) {
        await this.prisma.post.update({
          where: { id: postId },
          data: { car_detail_id: carDetailId },
        });
        if (process.env.SHOW_LOGS) {
          this.logger.info('linked car detail', {
            postId: postId.toString(),
            carDetailId: carDetailId.toString(),
          });
        }
      }

      await this.markImportCompleted(idempotencyKey, payloadHash);
      return post.id;
    } catch (e) {
      if (idempotencyClaimed && idempotencyKey && payloadHash) {
        await this.markImportFailed(idempotencyKey, payloadHash, e);
      }
      if (process.env.SHOW_LOGS) {
        this.logger.error('failed to import post', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(e);
    }
  }

  private buildImportPayloadHash(payload: unknown): string {
    const canonical = JSON.stringify(this.toCanonicalValue(payload));
    return createHash('sha256').update(canonical).digest('hex');
  }

  private toCanonicalValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.toCanonicalValue(item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      const output: Record<string, unknown> = {};
      for (const [key, entryValue] of entries) {
        output[key] = this.toCanonicalValue(entryValue);
      }
      return output;
    }
    return value;
  }

  private async claimImportIdempotency(
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<boolean> {
    const now = new Date();
    const inserted = await this.prisma.$executeRawUnsafe(
      `
        INSERT IGNORE INTO import_idempotency (
          idempotency_key,
          payload_hash,
          status,
          last_error,
          attempts,
          created_at,
          updated_at
        ) VALUES (?, ?, 'processing', NULL, 1, ?, ?)
      `,
      idempotencyKey,
      payloadHash,
      now,
      now,
    );

    if (Number(inserted) > 0) {
      return true;
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string }>>(
      `
        SELECT status
        FROM import_idempotency
        WHERE idempotency_key = ? AND payload_hash = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      idempotencyKey,
      payloadHash,
    );
    const status = String(rows[0]?.status ?? '');
    if (status !== 'failed') {
      return false;
    }

    const reclaimed = await this.prisma.$executeRawUnsafe(
      `
        UPDATE import_idempotency
        SET status = 'processing', last_error = NULL, attempts = attempts + 1, updated_at = ?
        WHERE idempotency_key = ? AND payload_hash = ? AND status = 'failed'
      `,
      now,
      idempotencyKey,
      payloadHash,
    );

    return Number(reclaimed) > 0;
  }

  private async markImportCompleted(
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
        UPDATE import_idempotency
        SET status = 'completed', updated_at = ?
        WHERE idempotency_key = ? AND payload_hash = ?
      `,
      new Date(),
      idempotencyKey,
      payloadHash,
    );
  }

  private async markImportFailed(
    idempotencyKey: string,
    payloadHash: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown');
    await this.prisma.$executeRawUnsafe(
      `
        UPDATE import_idempotency
        SET status = 'failed', last_error = ?, updated_at = ?
        WHERE idempotency_key = ? AND payload_hash = ?
      `,
      message,
      new Date(),
      idempotencyKey,
      payloadHash,
    );
  }

  private async createEmptyCarDetail(
    sold: boolean,
    customsPaid: boolean | null,
    now: Date,
    postId: bigint,
  ): Promise<bigint> {
    const carDetail = await this.prisma.car_detail.create({
      data: {
        id: postId,
        dateCreated: now,
        dateUpdated: now,
        post_id: postId,
        sold,
        customsPaid,
        published: false,
      },
    });
    if (process.env.SHOW_LOGS) {
      this.logger.info('created empty car detail', {
        carDetailId: carDetail.id.toString(),
        sold,
        customsPaid,
      });
    }

    return carDetail.id;
  }

  private async createCarDetail(
    carDetails: ImportPostData['cardDetails'],
    sold: boolean,
    customsPaid: boolean | null,
    now: Date,
    postId: bigint,
  ): Promise<bigint> {
    if (!carDetails) {
      // If no car details provided, create empty
      return this.createEmptyCarDetail(sold, customsPaid, now, postId);
    }

    const carDetail = await this.prisma.car_detail.create({
      data: {
        id: postId,
        dateCreated: now,
        dateUpdated: now,
        make: carDetails.make || null,
        model: carDetails.model || null,
        variant: carDetails.variant || null,
        registration: carDetails.registration
          ? carDetails.registration.toString()
          : null,
        mileage: carDetails.mileage || null,
        transmission: carDetails.transmission || null,
        fuelType: carDetails.fuelType || null,
        engineSize: carDetails.engine ? carDetails.engine.toString() : null,
        drivetrain: carDetails.drivetrain || null,
        seats: carDetails.seats || null,
        numberOfDoors: carDetails.numberOfDoors || null,
        bodyType: carDetails.bodyType || null,
        price: carDetails.price || null,
        customsPaid: customsPaid ?? null,
        sold,
        published: !!carDetails.make && !!carDetails.model,
        contact: carDetails.contact ? JSON.stringify(carDetails.contact) : '',
        options: carDetails.options || null,
        post_id: postId,
      },
    });
    if (process.env.SHOW_LOGS) {
      this.logger.info('created car detail', {
        carDetailId: carDetail.id.toString(),
        make: carDetails.make || 'N/A',
        model: carDetails.model || 'N/A',
        published: carDetail.published,
        sold,
        customsPaid,
      });
    }

    return carDetail.id;
  }

  private async ensureVendorExists(vendorId: bigint): Promise<boolean> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      // Create a basic vendor record
      return false;
    }

    return true;
  }

  /**
   * Mark a post as deleted and delete its associated images
   * @param postId - Post ID to mark as deleted
   * @param vendorId - Vendor ID for directory structure
   */
  private async markPostAsDeleted(
    postId: bigint,
    vendorId: bigint,
  ): Promise<void> {
    // Mark post as deleted in database
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        deleted: true,
        dateUpdated: new Date(),
      },
    });

    // Delete images from filesystem
    await this.deletePostImages(postId, vendorId);
  }

  /**
   * Delete all images associated with a post
   * @param postId - Post ID
   * @param vendorId - Vendor ID for directory structure
   */
  private async deletePostImages(
    postId: bigint,
    vendorId: bigint,
  ): Promise<void> {
    const baseUploadDir = process.env.UPLOAD_DIR || './tmp/uploads';
    const postDir = path.join(
      baseUploadDir,
      vendorId.toString(),
      postId.toString(),
    );

    try {
      // Check if directory exists
      await fs.access(postDir);

      // Delete the entire post directory
      await fs.rm(postDir, { recursive: true, force: true });
      if (process.env.SHOW_LOGS) {
        this.logger.info('deleted post image directory', {
          postId: postId.toString(),
          path: postDir,
        });
      }
    } catch (error) {
      // Directory doesn't exist or error deleting - log and continue
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('error deleting post images', {
          postId: postId.toString(),
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Process AI parsed results (JSON string) and update car_detail and post records.
   * Mirrors legacy PHP logic provided by user.
   */
  async importResult(data: string): Promise<{
    success: boolean;
    message: string;
    updated?: number;
    deleted?: number;
    errors?: Array<{ id: string | number; error: string }>;
  }> {
    let parsedData: ParsedResult[];
    try {
      const raw = JSON.parse(data) as unknown;
      if (!Array.isArray(raw)) {
        throw new Error('Parsed data must be an array');
      }
      parsedData = raw as ParsedResult[];
    } catch (e) {
      return {
        success: false,
        message: 'Invalid JSON payload',
        errors: [
          {
            id: 'N/A',
            error: e instanceof Error ? e.message : 'Unknown error',
          },
        ],
      };
    }

    let updated = 0;
    let deleted = 0;
    const errors: Array<{ id: string | number; error: string }> = [];

    for (const parsedResult of parsedData) {
      const id = parsedResult.id;
      if (!id) {
        errors.push({ id: 'N/A', error: 'Missing id in parsed result' });
        continue;
      }
      const postId = BigInt(id);

      try {
        if (this.resultIsEmpty(parsedResult)) {
          await this.prisma.post
            .update({
              where: { id: postId },
              data: { deleted: true, dateUpdated: new Date() },
            })
            .catch(() => undefined);

          const carDetail = await this.prisma.car_detail.findFirst({
            where: { post_id: postId },
            select: { id: true },
          });
          if (carDetail) {
            await this.prisma.car_detail.update({
              where: { id: carDetail.id },
              data: { deleted: true, dateUpdated: new Date() },
            });
          }
          deleted++;
          continue;
        }

        const existingCarDetail = await this.prisma.car_detail.findFirst({
          where: { post_id: postId },
          include: { post_car_detail_post_idTopost: true },
        });

        if (!existingCarDetail) {
          const now = new Date();
          const timestamp = BigInt(Date.now()) * 1000000n;
          const processId = BigInt(process.pid) * 1000n;
          const random = BigInt(Math.floor(Math.random() * 1000));
          const newId = timestamp + processId + random;

          await this.prisma.car_detail.create({
            data: {
              id: newId,
              dateCreated: now,
              dateUpdated: now,
              post_id: postId,
              published: true,
              deleted: false,
              sold: parsedResult.sold ?? false,
              make: parsedResult.make ?? null,
              model: parsedResult.model ?? null,
              variant: parsedResult.variant ?? null,
            },
          });
        } else {
          const cd = existingCarDetail;

          if (
            !Object.prototype.hasOwnProperty.call(parsedResult, 'priceVerified')
          ) {
            parsedResult.priceVerified = false;
          }
          if (
            !Object.prototype.hasOwnProperty.call(
              parsedResult,
              'mileageVerified',
            )
          ) {
            parsedResult.mileageVerified = false;
          }
          if (
            !Object.prototype.hasOwnProperty.call(parsedResult, 'fuelVerified')
          ) {
            parsedResult.fuelVerified = false;
          }

          await this.prisma.car_detail.update({
            where: { id: cd.id },
            data: {
              model: parsedResult.model ?? cd.model,
              make: parsedResult.make ?? cd.make,
              variant: parsedResult.variant ?? cd.variant,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              registration: (parsedResult.registration ??
                cd.registration) as any,
              mileage: parsedResult.mileage ?? cd.mileage,
              transmission: parsedResult.transmission ?? cd.transmission,
              fuelType: parsedResult.fuelType ?? cd.fuelType,
              engineSize: parsedResult.engineSize ?? cd.engineSize,
              drivetrain: parsedResult.drivetrain ?? cd.drivetrain,
              seats:
                parsedResult.seats !== undefined && parsedResult.seats !== null
                  ? parsedResult.seats
                  : cd.seats,
              numberOfDoors:
                parsedResult.numberOfDoors !== undefined &&
                parsedResult.numberOfDoors !== null
                  ? parsedResult.numberOfDoors
                  : cd.numberOfDoors,
              bodyType: parsedResult.bodyType ?? cd.bodyType,
              price: parsedResult.price ?? cd.price,
              emissionGroup: parsedResult.emissionGroup ?? cd.emissionGroup,
              sold: parsedResult.sold ?? cd.sold,
              customsPaid: parsedResult.customsPaid ?? cd.customsPaid,
              options: null,
              contact: parsedResult.contact
                ? JSON.stringify(parsedResult.contact)
                : cd.contact,
              published: true,
              type: parsedResult.type ?? cd.type,
              priceVerified:
                parsedResult.priceVerified ?? cd.priceVerified ?? false,
              mileageVerified:
                parsedResult.mileageVerified ?? cd.mileageVerified ?? false,
              dateUpdated: new Date(),
            },
          });

          const post = await this.prisma.post.findUnique({
            where: { id: postId },
          });
          if (post) {
            const postUpdateData = sanitizePostUpdateDataForSource(
              {
                status: parsedResult.status ?? post.status,
                origin: parsedResult.origin ?? post.origin,
                renewTo: parsedResult.renewTo ?? post.renewTo,
                highlightedTo: parsedResult.highlightedTo ?? post.highlightedTo,
                promotionTo: parsedResult.promotionTo ?? post.promotionTo,
                mostWantedTo: parsedResult.mostWantedTo ?? post.mostWantedTo,
                live: true,
                revalidate: false,
                dateUpdated: new Date(),
              },
              'untrusted',
            );
            await this.prisma.post.update({
              where: { id: postId },
              data: postUpdateData,
            });
          }
        }

        updated++;
      } catch (e) {
        errors.push({
          id,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return {
      success: errors.length === 0,
      message:
        errors.length === 0 ? 'Updated car detail' : 'Completed with errors',
      updated,
      deleted,
      errors: errors.length ? errors : undefined,
    };
  }

  private resultIsEmpty(result: ParsedResult): boolean {
    return (result.model ?? null) === null && (result.make ?? null) === null;
  }

  /**
   * Increment post metrics.
   *
   * - `impressions`: always increments, optional `visitorId` increments `reach` once per post.
   * - `clicks`: increments `clicks`.
   * - `contact`: increments total `contact` and optional method-specific counter.
   * - `postOpen`: legacy metric, increments both `postOpen` and `clicks`.
   * - `reach`: kept for backward compatibility, increments directly.
   */
  async incrementPostMetric(
    postId: bigint,
    metric: IncrementMetric,
    options: IncrementMetricOptions = {},
  ): Promise<void> {
    const allowedMetrics: IncrementMetric[] = [
      'postOpen',
      'impressions',
      'reach',
      'clicks',
      'contact',
    ];
    if (!allowedMetrics.includes(metric)) {
      throw new Error(
        `Invalid metric: ${metric}. Must be 'postOpen', 'impressions', 'reach', 'clicks', or 'contact'.`,
      );
    }

    if (metric === 'impressions') {
      await this.incrementSimpleMetric(postId, 'impressions');

      const sanitizedVisitorId = this.sanitizeVisitorId(options.visitorId);
      if (sanitizedVisitorId) {
        await this.incrementUniqueReach(postId, sanitizedVisitorId);
      }
      return;
    }

    if (metric === 'clicks') {
      await this.incrementSimpleMetric(postId, 'clicks');
      return;
    }

    if (metric === 'postOpen') {
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          postOpen: { increment: 1 },
          clicks: { increment: 1 },
        } as Prisma.postUpdateInput,
      });
      return;
    }

    if (metric === 'contact') {
      const updateData: Record<string, unknown> = {
        contact: { increment: 1 },
      };
      const contactMethod = this.normalizeContactMethod(options.contactMethod);
      if (options.contactMethod && !contactMethod) {
        throw new Error(
          `Invalid contact method: ${options.contactMethod}. Must be one of 'call', 'whatsapp', 'email', 'instagram'.`,
        );
      }
      if (contactMethod) {
        const contactMethodFieldMap: Record<ContactMethod, string> = {
          call: 'contactCall',
          whatsapp: 'contactWhatsapp',
          email: 'contactEmail',
          instagram: 'contactInstagram',
        };
        (updateData as Record<string, unknown>)[
          contactMethodFieldMap[contactMethod]
        ] = { increment: 1 };
      }

      await this.prisma.post.update({
        where: { id: postId },
        data: updateData as Prisma.postUpdateInput,
      });
      return;
    }

    // Legacy compatibility for direct reach increments.
    await this.incrementSimpleMetric(postId, 'reach');
  }

  private async incrementSimpleMetric(
    postId: bigint,
    metric: 'impressions' | 'reach' | 'clicks',
  ): Promise<void> {
    const updateData: Prisma.postUpdateInput = {
      [metric]: {
        increment: 1,
      },
    };

    await this.prisma.post.update({
      where: { id: postId },
      data: updateData,
    });
  }

  private async incrementUniqueReach(
    postId: bigint,
    visitorId: string,
  ): Promise<void> {
    const visitorHash = createHash('sha256').update(visitorId).digest('hex');

    const insertedRows = await this.prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO post_reach_unique (post_id, visitor_hash, dateCreated) VALUES (?, ?, NOW())',
      postId.toString(),
      visitorHash,
    );

    if (Number(insertedRows) > 0) {
      await this.incrementSimpleMetric(postId, 'reach');
    }
  }

  private sanitizeVisitorId(visitorId?: string): string | null {
    if (typeof visitorId !== 'string') {
      return null;
    }
    const trimmed = visitorId.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.slice(0, 255);
  }

  private normalizeContactMethod(contactMethod?: string): ContactMethod | null {
    if (!contactMethod) {
      return null;
    }
    const normalized = contactMethod.toLowerCase().trim();
    if (
      normalized === 'call' ||
      normalized === 'whatsapp' ||
      normalized === 'email' ||
      normalized === 'instagram'
    ) {
      return normalized;
    }
    return null;
  }
}
