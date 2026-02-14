import { Injectable } from '@nestjs/common';
import { mkdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import {
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';

type AnyRecord = Record<string, unknown>;

type UploadImageInput = {
  file: string;
  id: string;
  filename: string;
};

@Injectable()
export class LocalMediaService {
  private readonly mediaRoot = resolve(process.cwd(), 'media');
  private readonly mediaTmpRoot = resolve(this.mediaRoot, 'tmp');

  async uploadImage(
    raw: unknown,
  ): Promise<LegacyResponse | Record<string, unknown>> {
    const rawType = typeof raw;
    const rawKeys =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.keys(raw as Record<string, unknown>).slice(0, 5)
        : [];
    console.log(
      JSON.stringify({
        scope: 'local-media-service',
        event: 'upload-image.input-shape',
        rawType,
        rawKeys,
      }),
    );

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

    const sourceBuffer = await this.readSourceBuffer(image.file);
    if (!sourceBuffer) {
      return legacySuccess('');
    }

    try {
      await sharp(sourceBuffer).webp({ quality: 100 }).toFile(outputPath);
      return legacySuccess(outputUrl);
    } catch {
      return legacySuccess('');
    }
  }

  private normalizeInput(raw: unknown): UploadImageInput {
    const input = this.asRecord(raw);
    const nestedRaw = this.parseMaybeJson(input.imageData);
    const source =
      nestedRaw && typeof nestedRaw === 'object' && !Array.isArray(nestedRaw)
        ? (nestedRaw as AnyRecord)
        : input;

    return {
      file: this.asString(source.file),
      id: this.asString(source.id) || this.generateId(12),
      filename: this.asString(source.filename),
    };
  }

  private sanitizeId(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || this.generateId(12);
  }

  private async readSourceBuffer(source: string): Promise<Buffer | null> {
    if (!source) {
      return null;
    }

    if (source.startsWith('data:')) {
      const commaIndex = source.indexOf(',');
      if (commaIndex === -1) {
        return null;
      }
      const payload = source.slice(commaIndex + 1);
      const isBase64 = source.slice(0, commaIndex).includes(';base64');
      try {
        return Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
      } catch {
        return null;
      }
    }

    if (/^https?:\/\//i.test(source)) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          return null;
        }
        const arr = await response.arrayBuffer();
        return Buffer.from(arr);
      } catch {
        return null;
      }
    }

    try {
      return await readFile(source);
    } catch {
      return null;
    }
  }

  private asRecord(value: unknown): AnyRecord {
    const parsed = this.parseMaybeJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AnyRecord;
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
    if (typeof value !== 'string' || value.length !== 0) return input;

    const parsed = this.parseMaybeJson(key);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AnyRecord;
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
    return typeof value === 'string' ? value : '';
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
}
