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

@Injectable()
export class PostImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly imageDownloadService: ImageDownloadService,
  ) {}

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
    try {
      const now = new Date();
      const postId = BigInt(postData.id);

      if (process.env.SHOW_LOGS) {
        console.log(
          `📥 Processing post ${postId} | vendor: ${vendorId} | origin: ${postData.origin || 'N/A'}`,
        );
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
            console.log(
              `⚠️  Post ${postId} exists but is older than 3 months - marking as deleted`,
            );
          }
          // Mark post as deleted
          await this.markPostAsDeleted(postId, existingPost.vendor_id);
          if (process.env.SHOW_LOGS) {
            console.log(`🗑️  Post ${postId} marked as deleted`);
          }
          return null;
        }
      } else if (existingPost && existingPost.deleted) {
        if (process.env.SHOW_LOGS) {
          console.log(`⏭️  Skipping post ${postId} - already deleted`);
        }
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
          console.log(
            `🔴 Post ${postId} is marked as SOLD - marking and cleaning up images`,
          );
        }

        // Update post status to sold
        await this.prisma.post.upsert({
          where: { id: postId },
          create: {
            id: postId,
            dateCreated: now,
            dateUpdated: now,
            caption: encodedCaption,
            cleanedCaption,
            createdTime: postData.createdTime || now.toISOString(),
            sidecarMedias: '[]',
            vendor_id: BigInt(vendorId),
            live: false,
            likesCount: 0,
            viewsCount: 0,
            car_detail_id: null,
            origin: postData.origin || null,
            status: 'ARCHIVED',
            revalidate: false,
          },
          update: {
            status: 'ARCHIVED',
            dateUpdated: now,
          },
        });

        // Update car_detail if it exists to mark as sold
        const existingCarDetail = await this.prisma.car_detail.findFirst({
          where: { post_id: postId },
        });
        if (existingCarDetail) {
          await this.prisma.car_detail.update({
            where: { id: existingCarDetail.id },
            data: { sold: true, dateUpdated: now },
          });
        }

        // Delete post images
        await this.deletePostImages(postId, BigInt(vendorId));

        if (process.env.SHOW_LOGS) {
          console.log(`✅ Post ${postId} marked as SOLD and images cleaned up`);
        }

        return postId;
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
                  console.log(
                    `Post ${postData.id} is within last ${forceDownloadImagesDays} days - forcing image download`,
                  );
                }
              } else {
                if (process.env.SHOW_LOGS) {
                  console.log(
                    `Post ${postData.id} is older than ${forceDownloadImagesDays} days - skipping forced download`,
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
              console.log(
                `   📸 Downloaded ${imageUrls.length} images for post ${postData.id}${shouldForceDownload ? ' (forced)' : ''}`,
              );
            }
          }
        } catch (error) {
          console.error(
            `   ❌ Failed to download images for post ${postData.id}:`,
            error,
          );
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
        console.log(
          `======================================================================================`,
        );
        console.log(
          `   📝 Post should be revalidated: ${post.revalidate}. New cleaned caption differs from existing.`,
        );
        console.log(`New caption: ${cleanedCaption}`);
        console.log(
          `Existing caption: ${existingPost?.cleanedCaption || 'N/A'}`,
        );
        console.log(
          `======================================================================================`,
        );
      }
      if (process.env.SHOW_LOGS) {
        console.log(
          `✅ ${isNewPost ? 'Created new' : 'Updated'} post ${postId} | vendor: ${vendorId} | origin: ${postData.origin || 'N/A'} | sold: ${sold} | customsPaid: ${customsPaid}`,
        );
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
            console.log(
              `   🤖 Generating car details with OpenAI for post ${postId}`,
            );
          }
          carDetailsFromAI =
            await this.openaiService.generateCarDetails(cleanedCaption);
        }

        if (carDetailsFromAI && Object.keys(carDetailsFromAI).length > 0) {
          if (process.env.SHOW_LOGS) {
            console.log(
              `   ✨ OpenAI generated car details for post ${postId}`,
            );
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
              console.log(
                `   ⚠️  OpenAI did not generate car details for post ${postId} - creating empty`,
              );
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

      // Update post with car_detail_id if a car_detail was created
      if (carDetailId && isNewPost) {
        await this.prisma.post.update({
          where: { id: postId },
          data: { car_detail_id: carDetailId },
        });
        if (process.env.SHOW_LOGS) {
          console.log(
            `   ↳ Linked car_detail ${carDetailId} to post ${postId}`,
          );
        }
      }

      return post.id;
    } catch (e) {
      if (process.env.SHOW_LOGS) {
        console.error('❌ Failed to import post:', JSON.stringify(e));
      }
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(e);
    }
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
      console.log(
        `   ↳ Created empty car_detail ${carDetail.id} | sold: ${sold} | customsPaid: ${customsPaid}`,
      );
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
      console.log(
        `   ↳ Created car_detail ${carDetail.id} | make: ${carDetails.make || 'N/A'} | model: ${carDetails.model || 'N/A'} | published: ${carDetail.published} | sold: ${sold} | customsPaid: ${customsPaid}`,
      );
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
        console.log(`Deleted images directory for post ${postId}: ${postDir}`);
      }
    } catch (error) {
      // Directory doesn't exist or error deleting - log and continue
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(
          `Error deleting images for post ${postId}:`,
          (error as Error).message,
        );
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
            await this.prisma.post.update({
              where: { id: postId },
              data: {
                status: this.getPromotionFieldValueOrDefault(
                  parsedResult.status,
                  post.status,
                ),
                origin: this.getPromotionFieldValueOrDefault(
                  parsedResult.origin,
                  post.origin,
                ),
                renewTo: this.getPromotionFieldValueOrDefault(
                  parsedResult.renewTo,
                  post.renewTo,
                ),
                highlightedTo: this.getPromotionFieldValueOrDefault(
                  parsedResult.highlightedTo,
                  post.highlightedTo,
                ),
                promotionTo: this.getPromotionFieldValueOrDefault(
                  parsedResult.promotionTo,
                  post.promotionTo,
                ),
                mostWantedTo: this.getPromotionFieldValueOrDefault(
                  parsedResult.mostWantedTo,
                  post.mostWantedTo,
                ),
                live: true,
                revalidate: false,
                dateUpdated: new Date(),
              },
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

  private getPromotionFieldValueOrDefault<T>(
    value: T | null | undefined,
    defaultValue: T,
  ): T {
    return value ?? defaultValue;
  }

  private resultIsEmpty(result: ParsedResult): boolean {
    return (result.model ?? null) === null && (result.make ?? null) === null;
  }

  /**
   * Increment a post metric (postOpen, impressions, reach, clicks, or contact) asynchronously
   * @param postId - The ID of the post to increment
   * @param metric - The metric to increment ('postOpen', 'impressions', 'reach', 'clicks', or 'contact')
   * @throws Error if metric is invalid
   */
  async incrementPostMetric(
    postId: bigint,
    metric: 'postOpen' | 'impressions' | 'reach' | 'clicks' | 'contact',
  ): Promise<void> {
    if (
      !['postOpen', 'impressions', 'reach', 'clicks', 'contact'].includes(
        metric,
      )
    ) {
      throw new Error(
        `Invalid metric: ${metric}. Must be 'postOpen', 'impressions', 'reach', 'clicks', or 'contact'.`,
      );
    }

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
}
