import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  generateCleanedCaption,
  encodeCaption,
  isSold,
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
    const now = new Date();
    const postId = BigInt(postData.id);

    // Check if post exists and if it's older than 3 months
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        createdTime: true,
        vendor_id: true,
        deleted: true,
      },
    });

    if (existingPost && !existingPost.deleted) {
      // Check if existing post is older than 3 months
      if (!isWithinThreeMonths(existingPost.createdTime)) {
        console.log(
          `Post ${postId} exists but is older than 3 months - marking as deleted`,
        );
        // Mark post as deleted
        await this.markPostAsDeleted(postId, existingPost.vendor_id);
        return null;
      }
    } else if (existingPost && existingPost.deleted) {
      console.log(`Skipping post. Post ${postId} deleted`);
      return postId;
    }

    // Process caption
    const originalCaption = postData.caption || '';
    const cleanedCaption = generateCleanedCaption(originalCaption);
    const encodedCaption = encodeCaption(originalCaption);

    // Check if sold
    const sold = isSold(cleanedCaption);

    // Check if vendor exists, if not create it
    await this.ensureVendorExists(BigInt(vendorId));

    // Determine if we have car details
    let carDetailId: bigint | null = null;

    if (postData.origin === 'ENCAR' && postData.cardDetails) {
      // Encar: create car_detail from provided data
      carDetailId = await this.createCarDetail(postData.cardDetails, sold, now);
    } else if (postData.origin === 'INSTAGRAM') {
      // Instagram: create empty car_detail or use OpenAI
      let carDetailsFromAI: CarDetailFromAI | null = null;

      if (useOpenAI && cleanedCaption) {
        carDetailsFromAI =
          await this.openaiService.generateCarDetails(cleanedCaption);
      }

      if (carDetailsFromAI && Object.keys(carDetailsFromAI).length > 0) {
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
        carDetailId = await this.createCarDetail(aiAsCardDetails, sold, now);
      } else {
        // Create empty car_detail
        carDetailId = await this.createEmptyCarDetail(sold, now);
      }
    } else if (postData.cardDetails) {
      // Other sources with car details
      carDetailId = await this.createCarDetail(postData.cardDetails, sold, now);
    }

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
              console.log(
                `Post ${postData.id} is within last ${forceDownloadImagesDays} days - forcing image download`,
              );
            } else {
              console.log(
                `Post ${postData.id} is older than ${forceDownloadImagesDays} days - skipping forced download`,
              );
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
          console.log(
            `Downloaded ${imageUrls.length} images for post ${postData.id}${shouldForceDownload ? ' (forced)' : ''}`,
          );
        }
      } catch (error) {
        console.error(
          `Failed to download images for post ${postData.id}:`,
          error,
        );
        // Continue with post creation even if image download fails
      }
    }

    // Create or update post
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
        car_detail_id: carDetailId,
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
        car_detail_id: carDetailId,
      },
    });

    return post.id;
  }

  private async createEmptyCarDetail(
    sold: boolean,
    now: Date,
  ): Promise<bigint> {
    // Generate a unique ID using timestamp + process ID + random component
    // This reduces collision risk in concurrent scenarios
    const timestamp = BigInt(Date.now()) * 1000000n;
    const processId = BigInt(process.pid) * 1000n;
    const random = BigInt(Math.floor(Math.random() * 1000));
    const id = timestamp + processId + random;

    const carDetail = await this.prisma.car_detail.create({
      data: {
        id,
        dateCreated: now,
        dateUpdated: now,
        sold,
        published: false,
      },
    });

    return carDetail.id;
  }

  private async createCarDetail(
    carDetails: ImportPostData['cardDetails'],
    sold: boolean,
    now: Date,
  ): Promise<bigint> {
    if (!carDetails) {
      // If no car details provided, create empty
      return this.createEmptyCarDetail(sold, now);
    }

    // Generate a unique ID using timestamp + process ID + random component
    // This reduces collision risk in concurrent scenarios
    const timestamp = BigInt(Date.now()) * 1000000n;
    const processId = BigInt(process.pid) * 1000n;
    const random = BigInt(Math.floor(Math.random() * 1000));
    const id = timestamp + processId + random;

    const carDetail = await this.prisma.car_detail.create({
      data: {
        id,
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
        customsPaid: carDetails.customsPaid || false,
        sold,
        published: false,
        contact: carDetails.contact ? JSON.stringify(carDetails.contact) : '',
        options: carDetails.options || null,
      },
    });

    return carDetail.id;
  }

  private async ensureVendorExists(vendorId: bigint): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      // Create a basic vendor record
      await this.prisma.vendor.create({
        data: {
          id: vendorId,
          dateCreated: new Date(),
          dateUpdated: new Date(),
          deleted: false,
          accountExists: true,
        },
      });
    }
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
      console.log(`Deleted images directory for post ${postId}: ${postDir}`);
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
}
