import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImageVariants {
  main: string; // Path to main image (WebP, good quality)
  thumbnail: string; // Path to thumbnail (WebP, small)
  metadata: string; // Path to metadata image (JPG, small)
}

@Injectable()
export class ImageDownloadService {
  private readonly baseUploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
  private readonly mainQuality = 85;
  private readonly thumbnailSize = 300; // px
  private readonly metadataSize = 150; // px

  /**
   * Downloads and processes an image with proper directory structure
   * @param imageUrl - URL of the image to download
   * @param vendorId - Vendor ID for directory structure
   * @param postId - Post ID for directory structure
   * @param imageId - Image ID for filename
   * @returns Paths to the three image variants
   */
  async downloadAndProcessImage(
    imageUrl: string,
    vendorId: string | number,
    postId: string | number,
    imageId: string | number,
  ): Promise<ImageVariants> {
    try {
      // Create directory structure: BASE_PATH/vendorId/postId/
      const uploadDir = path.join(
        this.baseUploadDir,
        vendorId.toString(),
        postId.toString(),
      );
      await fs.mkdir(uploadDir, { recursive: true });

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // We'll use sharp if available, otherwise save original and create basic variants
      let sharp: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sharp = require('sharp');
      } catch {
        // Sharp not available, use basic file operations
        return this.saveFallbackVariants(buffer, uploadDir, imageId.toString());
      }

      const imageIdStr = imageId.toString();

      // Main image: good quality WebP
      const mainPath = path.join(uploadDir, `${imageIdStr}.webp`);
      await sharp(buffer).webp({ quality: this.mainQuality }).toFile(mainPath);

      // Thumbnail: small WebP
      const thumbnailPath = path.join(uploadDir, `${imageIdStr}-thumb.webp`);
      await sharp(buffer)
        .resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      // Metadata: small JPG
      const metadataPath = path.join(uploadDir, `${imageIdStr}-meta.jpg`);
      await sharp(buffer)
        .resize(this.metadataSize, this.metadataSize, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75 })
        .toFile(metadataPath);

      return {
        main: mainPath,
        thumbnail: thumbnailPath,
        metadata: metadataPath,
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  /**
   * Fallback method when sharp is not available
   * Saves original image in all three variants (without actual processing)
   */
  private async saveFallbackVariants(
    buffer: Buffer,
    uploadDir: string,
    imageId: string,
  ): Promise<ImageVariants> {
    const mainPath = path.join(uploadDir, `${imageId}.jpg`);
    const thumbnailPath = path.join(uploadDir, `${imageId}-thumb.jpg`);
    const metadataPath = path.join(uploadDir, `${imageId}-meta.jpg`);

    await Promise.all([
      fs.writeFile(mainPath, buffer),
      fs.writeFile(thumbnailPath, buffer),
      fs.writeFile(metadataPath, buffer),
    ]);

    console.warn(
      'Sharp not available - images saved without processing. Install sharp for proper image optimization.',
    );

    return {
      main: mainPath,
      thumbnail: thumbnailPath,
      metadata: metadataPath,
    };
  }

  /**
   * Downloads and processes multiple images for a post
   * @param imageUrls - Array of image URLs to download
   * @param vendorId - Vendor ID for directory structure
   * @param postId - Post ID for directory structure
   * @returns Array of paths to image variants
   */
  async downloadAndProcessImages(
    imageUrls: string[],
    vendorId: string | number,
    postId: string | number,
  ): Promise<ImageVariants[]> {
    const results: ImageVariants[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      // Use the image index or extract ID from URL if available
      const imageId = `image-${i.toString().padStart(3, '0')}`;
      
      try {
        const variants = await this.downloadAndProcessImage(
          imageUrl,
          vendorId,
          postId,
          imageId,
        );
        results.push(variants);
      } catch (error) {
        console.error(`Failed to process image ${i} (${imageUrl}):`, error);
        // Continue with other images
      }
    }

    return results;
  }
}
