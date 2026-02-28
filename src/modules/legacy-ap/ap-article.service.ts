import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class ApArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async articleAll() {
    const articles = await this.prisma.article.findMany({
      where: { deleted: false },
      orderBy: { dateUpdated: 'desc' },
      take: 500,
    });
    return legacySuccess(articles.map((row) => this.normalizeBigInts(row)));
  }

  async articleRead(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    return legacySuccess(this.normalizeBigInts(article));
  }

  async articleCreate(raw: unknown) {
    const payload = this.toObject(raw);
    const id = this.generateId(10, false);
    const image = this.toSafeString(payload.image);
    const created = await this.prisma.article.create({
      data: {
        id,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        title: this.extractArticleTitle(payload.data),
        category: this.toSafeString(payload.category),
        data: this.stringifyData(payload.data),
        image,
        appName: this.toSafeString(payload.appName) || 'autoconnect',
      },
    });
    return legacySuccess(this.normalizeBigInts(created));
  }

  async articleUpdate(id: string, raw: unknown) {
    const payload = this.toObject(raw);
    const image = this.toSafeString(payload.image);

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        category: this.toSafeString(payload.category),
        appName: this.toSafeString(payload.appName) || 'autoconnect',
        data: this.stringifyData(payload.data),
        title: this.extractArticleTitle(payload.data),
        image: image.startsWith('media/') ? undefined : image,
        dateUpdated: new Date(),
      },
    });

    return legacySuccess(this.normalizeBigInts(updated));
  }

  private generateId(length: number, onlyNumbers = true): string {
    const chars = onlyNumbers
      ? '0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let output = '';
    for (let index = 0; index < length; index += 1) {
      output += chars[Math.floor(Math.random() * chars.length)] ?? '0';
    }
    return output;
  }

  private toObject(value: unknown): AnyRecord {
    if (!value || typeof value !== 'object') return {};
    return value as AnyRecord;
  }

  private stringifyData(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(Array.isArray(value) ? value : []);
    } catch {
      return '[]';
    }
  }

  private extractArticleTitle(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    const first = data[0];
    if (!first || typeof first !== 'object') return '';
    return this.toSafeString((first as AnyRecord).title);
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
