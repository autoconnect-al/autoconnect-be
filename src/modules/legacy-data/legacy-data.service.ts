import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';

@Injectable()
export class LegacyDataService {
  constructor(private readonly prisma: PrismaService) {}

  async makes(type = 'car') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ Make: string | null }>
    >(
      'SELECT DISTINCT Make FROM car_make_model WHERE type = ? ORDER BY Make ASC',
      type,
    );
    return legacySuccess(rows.map((row) => row.Make).filter(Boolean));
  }

  async models(make: string, type = 'car', full = false) {
    const cleanedMake =
      type === 'car' &&
      make.toLowerCase() !== 'mercedes-benz' &&
      make.toLowerCase() !== 'rolls-royce' &&
      make.toLowerCase() !== 'harley-davidson'
        ? make.replace(/(?<! )-(?! )/g, ' ')
        : make;
    if (full) {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ Model: string | null; isVariant: number | boolean | null }>
      >(
        'SELECT DISTINCT Model, isVariant FROM car_make_model WHERE type = ? AND Make = ? ORDER BY id ASC',
        type,
        cleanedMake,
      );
      return legacySuccess(
        rows
          .filter((row) => !!row.Model)
          .map((row) => ({
            model: row.Model,
            isVariant: Number(row.isVariant ?? 0),
          })),
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ Model: string | null }>
    >(
      'SELECT DISTINCT Model FROM car_make_model WHERE type = ? AND Make = ? ORDER BY id ASC',
      type,
      cleanedMake,
    );
    return legacySuccess(rows.map((row) => row.Model).filter(Boolean));
  }

  async vendor(name: string) {
    const cleanedName = name.replace(/-/g, '.');
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      'SELECT * FROM vendor WHERE accountName = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
      cleanedName,
    );
    return legacySuccess(this.normalizeBigInts(rows[0] ?? null));
  }

  async vendorBiography(name: string) {
    const cleanedName = name.replace(/-/g, '.');
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ biography: string | null; profilePicture: string | null }>
    >(
      'SELECT biography, profilePicture FROM vendor WHERE accountName = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
      cleanedName,
    );
    if (!rows[0]) return legacySuccess(null);
    return legacySuccess({
      biography: this.normalizeBiography(rows[0].biography ?? ''),
      profilePicture: rows[0].profilePicture,
    });
  }

  async article(lang: string, id: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      'SELECT * FROM article WHERE id = ? AND appName = ? AND deleted = 0 LIMIT 1',
      id,
      app,
    );
    if (!rows[0]) {
      return {
        success: true,
        message: '',
        statusCode: '200',
      };
    }
    return legacySuccess(rows[0]);
  }

  async articles(
    lang: string,
    category: string,
    page = 0,
    app = 'autoconnect',
  ) {
    const offset = Math.max(page, 0) * 9;
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      'SELECT * FROM article WHERE category = ? AND appName = ? AND deleted = 0 ORDER BY dateCreated DESC LIMIT 9 OFFSET ?',
      category,
      app,
      offset,
    );
    return legacySuccess(rows);
  }

  async articlesTotal(lang: string, category: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint | number }>
    >(
      'SELECT COUNT(*) as total FROM article WHERE category = ? AND appName = ? AND deleted = 0',
      category,
      app,
    );
    return legacySuccess(Math.ceil(Number(rows[0]?.total ?? 0) / 9));
  }

  async latestArticles(lang: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        category: string;
        data: string | null;
        image: string | null;
        dateCreated: Date | string;
      }>
    >(
      'SELECT id, category, data, image, dateCreated FROM article WHERE deleted = 0 AND appName = ? GROUP BY category ORDER BY dateCreated DESC LIMIT 5',
      app,
    );
    const mapped = rows.map((row) => ({
      ...row,
      data: this.filterArticleDataByLanguage(row.data, lang),
    }));
    return legacySuccess(mapped);
  }

  async relatedArticles(
    lang: string,
    category: string,
    app = 'autoconnect',
    excludeId?: string,
  ) {
    const excludeClause = excludeId ? 'AND id <> ?' : '';
    const query = `SELECT * FROM article WHERE category = ? AND appName = ? AND deleted = 0 ${excludeClause} ORDER BY dateCreated DESC LIMIT 3`;
    const rows = excludeId
      ? await this.prisma.$queryRawUnsafe<unknown[]>(
          query,
          category,
          app,
          excludeId,
        )
      : await this.prisma.$queryRawUnsafe<unknown[]>(query, category, app);
    return legacySuccess(rows);
  }

  async metadata(lang: string, id: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        image: string | null;
        category: string;
      }>
    >(
      'SELECT id, title, image, category FROM article WHERE id = ? AND appName = ? AND deleted = 0 LIMIT 1',
      id,
      app,
    );
    if (!rows[0]) {
      return {
        success: true,
        message: '',
        statusCode: '200',
      };
    }
    return legacySuccess(rows[0]);
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }

  private filterArticleDataByLanguage(
    data: string | null,
    lang: string,
  ): string {
    if (!data) return JSON.stringify([]);
    try {
      const parsed = JSON.parse(data) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) return JSON.stringify([]);
      const filtered = parsed.filter(
        (item) => String(item?.language ?? '') === lang,
      );
      return JSON.stringify(filtered);
    } catch {
      return JSON.stringify([]);
    }
  }

  private normalizeBiography(input: string): string {
    return input
      .replace(/ ,/g, ',')
      .replace(/ !/g, '! ')
      .replace(/ - /g, '-')
      .replace(/ : /g, ':')
      .replace(/: /g, ':')
      .replace(/ :/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
