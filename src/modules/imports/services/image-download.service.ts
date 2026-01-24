import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

export interface ImageVariants {
  imageStandardResolutionUrl: string; // Path to main image (WebP, good quality)
  imageThumbnailUrl: string; // Path to thumbnail (WebP, small)
  metadata: string; // Path to metadata image (JPG, small)
}

@Injectable()
export class ImageDownloadService {
  private readonly baseUploadDir = process.env.UPLOAD_DIR || './tmp/uploads';
  private readonly baseProdPath = '/var/www/backend_main/'; // Production path prefix to remove
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

      const imageIdStr = imageId.toString();

      // Define expected file paths
      const mainPath = path.join(uploadDir, `${imageIdStr}.webp`);
      const thumbnailPath = path.join(uploadDir, `${imageIdStr}-thumb.webp`);
      const metadataPath = path.join(uploadDir, `${imageIdStr}-meta.jpg`);

      // Check if all three variants already exist
      const filesExist = await this.checkFilesExist([
        mainPath,
        thumbnailPath,
        metadataPath,
      ]);

      if (filesExist) {
        console.log(
          `Images already exist for ${imageIdStr}, skipping download`,
        );
        return {
          imageStandardResolutionUrl: mainPath.replace(this.baseProdPath, ''),
          imageThumbnailUrl: thumbnailPath.replace(this.baseProdPath, ''),
          metadata: metadataPath.replace(this.baseProdPath, ''),
        };
      }

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        // Main image: good quality WebP
        await sharp(buffer)
          .webp({ quality: this.mainQuality })
          .toFile(mainPath);

        // Thumbnail: small WebP
        await sharp(buffer)
          .resize(this.thumbnailSize, this.thumbnailSize, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(thumbnailPath);

        // Metadata: small JPG
        await sharp(buffer)
          .resize(this.metadataSize, this.metadataSize, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 75 })
          .toFile(metadataPath);

        return {
          imageStandardResolutionUrl: mainPath.replace(this.baseProdPath, ''),
          imageThumbnailUrl: thumbnailPath.replace(this.baseProdPath, ''),
          metadata: metadataPath.replace(this.baseProdPath, ''),
        };
      } catch (e) {
        console.warn('Sharp processing failed, using fallback:', e);
        return this.saveFallbackVariants(buffer, uploadDir, imageId.toString());
      }
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  /**
   * Check if all specified files exist
   * @param filePaths - Array of file paths to check
   * @returns true if all files exist, false otherwise
   */
  private async checkFilesExist(filePaths: string[]): Promise<boolean> {
    try {
      const checks = await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            await fs.access(filePath);
            return true;
          } catch {
            return false;
          }
        }),
      );
      return checks.every((exists) => exists);
    } catch {
      return false;
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
      imageStandardResolutionUrl: mainPath.replace(this.baseProdPath, ''),
      imageThumbnailUrl: thumbnailPath.replace(this.baseProdPath, ''),
      metadata: metadataPath.replace(this.baseProdPath, ''),
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
    imageUrls: { imageUrls: string; name: string | number }[],
    vendorId: string | number,
    postId: string | number,
  ): Promise<ImageVariants[]> {
    const results: ImageVariants[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i].imageUrls;
      // Use the image index or extract ID from URL if available

      try {
        const variants = await this.downloadAndProcessImage(
          imageUrl,
          vendorId,
          postId,
          imageUrls[i].name || `image-${i.toString().padStart(3, '0')}`,
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
