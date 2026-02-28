import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import * as process from 'node:process';
import { createLogger } from '../../../common/logger.util';

export interface ImageVariants {
  imageStandardResolutionUrl: string; // Path to main image (WebP, good quality)
  imageThumbnailUrl: string; // Path to thumbnail (WebP, small)
  metadata: string; // Path to metadata image (JPG, small)
}

@Injectable()
export class ImageDownloadService {
  private readonly logger = createLogger('image-download-service');
  private readonly baseUploadDir = process.env.UPLOAD_DIR || './tmp/uploads';
  private readonly baseProdPath = '/var/www/backend_main/'; // Production path prefix to remove
  private readonly mainQuality = 90; // Increased for better quality
  private readonly thumbnailSize = 500; // Increased size for better quality
  private readonly thumbnailQuality = 85; // Increased quality
  private readonly metadataSize = 200; // Increased size for better quality
  private readonly metadataQuality = 80; // Increased quality

  /**
   * Downloads and processes an image with proper directory structure
   * @param imageUrl - URL of the image to download
   * @param vendorId - Vendor ID for directory structure
   * @param postId - Post ID for directory structure
   * @param imageId - Image ID for filename
   * @param forceDownload - If true, re-download even if files exist
   * @returns Paths to the three image variants
   */
  async downloadAndProcessImage(
    imageUrl: string,
    vendorId: string | number,
    postId: string | number,
    imageId: string | number,
    forceDownload = false,
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

      // Check if all three variants already exist (unless forcing download)
      if (!forceDownload) {
        const filesExist = await this.checkFilesExist([
          mainPath,
          thumbnailPath,
          metadataPath,
        ]);

        if (filesExist) {
          if (process.env.SHOW_LOGS) {
            this.logger.info('images already exist; skipping download', {
              imageId: imageIdStr,
            });
          }
          return {
            imageStandardResolutionUrl: mainPath.replace(this.baseProdPath, ''),
            imageThumbnailUrl: thumbnailPath.replace(this.baseProdPath, ''),
            metadata: metadataPath.replace(this.baseProdPath, ''),
          };
        }
      } else {
        if (process.env.SHOW_LOGS) {
          this.logger.info('force downloading images', { imageId: imageIdStr });
        }
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

        // Thumbnail: small WebP with higher quality
        await sharp(buffer)
          .resize(this.thumbnailSize, this.thumbnailSize, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: this.thumbnailQuality })
          .toFile(thumbnailPath);

        // Metadata: small JPG with higher quality
        await sharp(buffer)
          .resize(this.metadataSize, this.metadataSize, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: this.metadataQuality })
          .toFile(metadataPath);

        return {
          imageStandardResolutionUrl: mainPath.replace(this.baseProdPath, ''),
          imageThumbnailUrl: thumbnailPath.replace(this.baseProdPath, ''),
          metadata: metadataPath.replace(this.baseProdPath, ''),
        };
      } catch (e) {
        if (process.env.SHOW_LOGS) {
          this.logger.warn('Sharp processing failed, using fallback', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return this.saveFallbackVariants(buffer, uploadDir, imageId.toString());
      }
    } catch (error) {
      this.logger.error('Error processing image', {
        error: error instanceof Error ? error.message : String(error),
      });
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

    if (process.env.SHOW_LOGS) {
      this.logger.warn(
        'Sharp not available - images saved without processing. Install sharp for proper image optimization.',
      );
    }

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
   * @param forceDownload - If true, re-download even if files exist
   * @returns Array of paths to image variants
   */
  async downloadAndProcessImages(
    imageUrls: { imageUrls: string; name: string | number }[],
    vendorId: string | number,
    postId: string | number,
    forceDownload = false,
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
          forceDownload,
        );
        results.push(variants);
      } catch (error) {
        this.logger.error('Failed to process image', {
          index: i,
          imageUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other images
      }
    }

    return results;
  }
}
