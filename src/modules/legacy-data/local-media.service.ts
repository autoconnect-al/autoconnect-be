import { Injectable } from '@nestjs/common';
import { mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';
import { getMediaRootPath } from '../../common/media-path.util';
import { createLogger } from '../../common/logger.util';

type AnyRecord = Record<string, unknown>;

type UploadImageInput = {
  file: string;
  id: string;
  filename: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Injectable()
export class LocalMediaService {
  private readonly logger = createLogger('local-media-service');
  private readonly mediaRoot = getMediaRootPath();
  private readonly mediaTmpRoot = resolve(this.mediaRoot, 'tmp');

  async uploadImage(
    raw: unknown,
    uploadedFiles: Express.Multer.File[] = [],
  ): Promise<LegacyResponse | Record<string, unknown>> {
    const rawType = typeof raw;
    const rawKeys =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.keys(raw as Record<string, unknown>).slice(0, 5)
        : [];
    this.logger.info('upload-image.input-shape', { rawType, rawKeys });

    const image = this.normalizeInput(raw);
    if (!image.file) {
      return {
        success: false,
        message: 'Image data is required.',
        statusCode: '500',
      };
    }

    const outputId = this.sanitizeId(image.id);
    const outputPath = join(this.mediaTmpRoot, `${outputId}.webp`);
    const outputUrl = `/media/tmp/${outputId}.webp`;

    await mkdir(this.mediaRoot, { recursive: true });
    await mkdir(this.mediaTmpRoot, { recursive: true });

    const sourceBuffer = await this.readSourceBuffer(image.file, uploadedFiles);
    if (!sourceBuffer) {
      return legacyError('Unsupported image source. Use multipart file or data URI.', 400);
    }
    if (sourceBuffer.length > MAX_UPLOAD_BYTES) {
      return legacyError('Image exceeds max size limit.', 400);
    }

    try {
      await sharp(sourceBuffer).webp({ quality: 100 }).toFile(outputPath);
      return legacySuccess(outputUrl);
    } catch {
      return legacyError('Invalid image payload.', 400);
    }
  }

  private normalizeInput(raw: unknown): UploadImageInput {
    const input = this.asRecord(raw);
    const source = this.extractLikelyPayload(input);
    const file =
      this.asString(source.file) ||
      this.asString(source.image) ||
      this.asString(source.content);

    return {
      file,
      id: this.asString(source.id) || this.generateId(12),
      filename: this.asString(source.filename),
    };
  }

  private sanitizeId(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || this.generateId(12);
  }

  private async readSourceBuffer(
    source: string,
    uploadedFiles: Express.Multer.File[],
  ): Promise<Buffer | null> {
    const firstFile = uploadedFiles[0];
    if (firstFile?.buffer?.length) {
      return firstFile.buffer;
    }

    if (!source) return null;

    if (source.startsWith('data:')) {
      const commaIndex = source.indexOf(',');
      if (commaIndex === -1) {
        return null;
      }
      const header = source.slice(0, commaIndex).toLowerCase();
      if (!header.startsWith('data:image/') || !header.includes(';base64')) {
        return null;
      }
      const payload = source.slice(commaIndex + 1);
      try {
        return Buffer.from(payload, 'base64');
      } catch {
        return null;
      }
    }

    if (/^https?:\/\//i.test(source)) {
      return null;
    }

    if (this.looksLikeLocalPath(source)) {
      return null;
    }

    if (this.looksLikeBase64(source)) {
      try {
        return Buffer.from(source, 'base64');
      } catch {
        return null;
      }
    }

    return null;
  }

  private asRecord(value: unknown): AnyRecord {
    if (typeof value === 'string') {
      const parsed = this.parseMaybeJson(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AnyRecord;
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return this.normalizeLegacyUrlEncodedJsonObject(value as AnyRecord);
    }
    return {};
  }

  private normalizeLegacyUrlEncodedJsonObject(input: AnyRecord): AnyRecord {
    const entries = Object.entries(input);
    if (entries.length !== 1) return input;

    const [key, value] = entries[0];
    if (typeof value !== 'string') return input;

    const keyText = key.trim();
    if (
      !(keyText.startsWith('{') && keyText.endsWith('}')) &&
      !(keyText.startsWith('[') && keyText.endsWith(']')) &&
      !keyText.startsWith('{')
    ) {
      return input;
    }

    const candidates =
      value.length === 0 ? [key] : [key, `${key}=${value}`, `${key}==${value}`];

    for (const candidate of candidates) {
      const parsed = this.parseMaybeJson(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AnyRecord;
      }
    }

    return input;
  }

  private parseMaybeJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!text) return value;
    if (
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    ) {
      try {
        return JSON.parse(text);
      } catch {
        return value;
      }
    }
    return value;
  }

  private asString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
    return '';
  }

  private extractLikelyPayload(input: AnyRecord): AnyRecord {
    if (this.looksLikeUploadPayload(input)) return input;

    const nested = this.parseMaybeJson(input.imageData);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const candidate = nested as AnyRecord;
      if (this.looksLikeUploadPayload(candidate)) return candidate;
    }

    for (const value of Object.values(input)) {
      const parsed = this.parseMaybeJson(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = parsed as AnyRecord;
        if (this.looksLikeUploadPayload(candidate)) return candidate;
      }
    }

    return input;
  }

  private looksLikeUploadPayload(input: AnyRecord): boolean {
    return Boolean(
      this.asString(input.file) ||
      this.asString(input.image) ||
      this.asString(input.content),
    );
  }

  private generateId(length: number): string {
    const alphabet =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private looksLikeLocalPath(source: string): boolean {
    return (
      source.startsWith('/') ||
      source.startsWith('./') ||
      source.startsWith('../') ||
      /^[a-z]:\\/i.test(source) ||
      source.startsWith('file://')
    );
  }

  private looksLikeBase64(source: string): boolean {
    const text = source.replace(/\s+/g, '');
    if (text.length < 16 || text.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/=]+$/.test(text);
  }
}
