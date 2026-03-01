import { Injectable } from '@nestjs/common';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { PrismaService } from '../../database/prisma.service';
import { enrichRowsWithPostStats } from '../../common/post-stats-enrichment.util';

const MAX_FAVOURITES_IDS = 200;
const FAVOURITES_CACHE_TTL_MS = 30_000;
const FAVOURITES_CACHE_MAX_ENTRIES = 500;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

@Injectable()
export class LegacyFavouritesService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private parseIds(value?: string): { ids: string[]; tooMany: boolean } {
    const ids = (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id));
    return {
      ids: ids.slice(0, MAX_FAVOURITES_IDS),
      tooMany: ids.length > MAX_FAVOURITES_IDS,
    };
  }

  async checkFavourites(favourites?: string) {
    const { ids, tooMany } = this.parseIds(favourites);
    if (tooMany) {
      return legacyError(
        `Too many favourites IDs (max ${MAX_FAVOURITES_IDS}).`,
        400,
      );
    }
    if (ids.length === 0) {
      return legacySuccess([]);
    }
    const cacheKey = this.cacheKey('check', ids);
    const cached = this.readCache<string[]>(cacheKey);
    if (cached) {
      return legacySuccess(cached);
    }
    const rows = await this.prisma.search.findMany({
      where: {
        id: { in: ids.map((id) => BigInt(id)) },
        deleted: '0',
        sold: false,
      },
      select: { id: true },
    });
    const result = rows.map((row) => row.id.toString());
    this.writeCache(cacheKey, result);
    return legacySuccess(result);
  }

  async getFavourites(favourites?: string) {
    const { ids, tooMany } = this.parseIds(favourites);
    if (tooMany) {
      return legacyError(
        `Too many favourites IDs (max ${MAX_FAVOURITES_IDS}).`,
        400,
      );
    }
    if (ids.length === 0) {
      return legacySuccess([]);
    }
    const cacheKey = this.cacheKey('get', ids);
    const cached = this.readCache<unknown[]>(cacheKey);
    if (cached) {
      const enrichedCached = await enrichRowsWithPostStats(this.prisma, cached);
      return legacySuccess(enrichedCached);
    }
    const rows = await this.prisma.search.findMany({
      where: {
        id: { in: ids.map((id) => BigInt(id)) },
        deleted: '0',
        sold: false,
      },
    });
    const result = this.normalizeBigInts(rows);
    this.writeCache(cacheKey, result);
    const enrichedResult = await enrichRowsWithPostStats(
      this.prisma,
      result as unknown[],
    );
    return legacySuccess(enrichedResult);
  }

  private cacheKey(scope: 'check' | 'get', ids: string[]): string {
    const normalized = Array.from(new Set(ids)).sort((a, b) =>
      a.localeCompare(b),
    );
    return `${scope}:${normalized.join(',')}`;
  }

  private readCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: unknown): void {
    if (this.cache.size >= FAVOURITES_CACHE_MAX_ENTRIES) {
      const now = Date.now();
      for (const [entryKey, entry] of this.cache) {
        if (entry.expiresAt <= now) {
          this.cache.delete(entryKey);
        }
      }
      if (this.cache.size >= FAVOURITES_CACHE_MAX_ENTRIES) {
        this.cache.clear();
      }
    }
    this.cache.set(key, {
      expiresAt: Date.now() + FAVOURITES_CACHE_TTL_MS,
      value,
    });
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
