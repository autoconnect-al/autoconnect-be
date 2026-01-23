import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  generateCleanedCaption,
  encodeCaption,
  isSold,
} from '../utils/caption-processor';
import { OpenAIService, CarDetailFromAI } from './openai.service';

export interface ImportPostData {
  id: number | string;
  caption?: string;
  createdTime?: string;
  likesCount?: number;
  viewsCount?: number;
  sidecarMedias?: Array<{
    id: number | string;
    imageStandardResolutionUrl: string;
    type: 'image' | 'video';
  }>;
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
    contact?: any;
    vin?: string;
    options?: string;
  };
}

@Injectable()
export class PostImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
  ) {}

  /**
   * Import a post with optional car details
   * @param postData - Post data to import
   * @param vendorId - Vendor ID
   * @param useOpenAI - Whether to use OpenAI to generate car details
   * @returns Saved post ID
   */
  async importPost(
    postData: ImportPostData,
    vendorId: number,
    useOpenAI = false,
  ): Promise<bigint> {
    const now = new Date();

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
        carDetailId = await this.createCarDetail(
          carDetailsFromAI as any,
          sold,
          now,
        );
      } else {
        // Create empty car_detail
        carDetailId = await this.createEmptyCarDetail(sold, now);
      }
    } else if (postData.cardDetails) {
      // Other sources with car details
      carDetailId = await this.createCarDetail(postData.cardDetails, sold, now);
    }

    // Create or update post
    const postId = BigInt(postData.id);

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
          ? (postData.sidecarMedias as any)
          : null,
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
          ? (postData.sidecarMedias as any)
          : null,
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
    // Generate a unique ID based on timestamp + random component
    const id = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
    
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
    carDetails: any,
    sold: boolean,
    now: Date,
  ): Promise<bigint> {
    // Generate a unique ID based on timestamp + random component
    const id = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
    
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
        engineSize: carDetails.engineSize
          ? carDetails.engineSize.toString()
          : carDetails.engine
            ? carDetails.engine.toString()
            : null,
        drivetrain: carDetails.drivetrain || null,
        seats: carDetails.seats || null,
        numberOfDoors: carDetails.numberOfDoors || null,
        bodyType: carDetails.bodyType || null,
        price: carDetails.price || null,
        customsPaid: carDetails.customsPaid || false,
        sold,
        published: false,
        contact: carDetails.contact ? carDetails.contact : null,
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
}
