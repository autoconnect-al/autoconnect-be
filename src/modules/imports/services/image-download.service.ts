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
  private readonly uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
  private readonly mainQuality = 85;
  private readonly thumbnailSize = 300; // px
  private readonly metadataSize = 150; // px

  async downloadAndProcessImage(
    imageUrl: string,
    targetFilename: string,
  ): Promise<ImageVariants> {
    try {
      // Ensure upload directory exists
      await fs.mkdir(this.uploadDir, { recursive: true });

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
        return this.saveFallbackVariants(buffer, targetFilename);
      }

      const baseName = path.parse(targetFilename).name;

      // Main image: good quality WebP
      const mainPath = path.join(this.uploadDir, `${baseName}.webp`);
      await sharp(buffer).webp({ quality: this.mainQuality }).toFile(mainPath);

      // Thumbnail: small WebP
      const thumbnailPath = path.join(this.uploadDir, `${baseName}-thumb.webp`);
      await sharp(buffer)
        .resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      // Metadata: small JPG
      const metadataPath = path.join(this.uploadDir, `${baseName}-meta.jpg`);
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
    targetFilename: string,
  ): Promise<ImageVariants> {
    const baseName = path.parse(targetFilename).name;

    const mainPath = path.join(this.uploadDir, `${baseName}.jpg`);
    const thumbnailPath = path.join(this.uploadDir, `${baseName}-thumb.jpg`);
    const metadataPath = path.join(this.uploadDir, `${baseName}-meta.jpg`);

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
   * Downloads and processes multiple images
   */
  async downloadAndProcessImages(
    imageUrls: string[],
    baseFilename: string,
  ): Promise<ImageVariants[]> {
    const results: ImageVariants[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const filename = `${baseFilename}-${i.toString().padStart(2, '0')}`;
      try {
        const variants = await this.downloadAndProcessImage(
          imageUrls[i],
          filename,
        );
        results.push(variants);
      } catch (error) {
        console.error(`Failed to process image ${i}:`, error);
        // Continue with other images
      }
    }

    return results;
  }
}
