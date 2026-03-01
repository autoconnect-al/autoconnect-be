import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { createLogger } from '../../common/logger.util';
import type { SearchFilter } from '../legacy-search/legacy-search-query-builder';

export type PersonalizationEvent = 'search' | 'open' | 'contact' | 'impression';

export type PersonalizationTermScore = {
  termKey: string;
  termValue: string;
  score: number;
  searchCount?: number;
  openCount?: number;
  contactCount?: number;
  impressionCount?: number;
  dateUpdated?: Date | string | number | null;
  lastEventAt?: Date | string | number | null;
};

type EventCounters = {
  searchCount: number;
  openCount: number;
  contactCount: number;
  impressionCount: number;
};

type WeightedTerm = {
  termKey: string;
  termValue: string;
  delta: number;
  counters: EventCounters;
};

type PostSignalRow = {
  make: string | null;
  model: string | null;
  bodyType: string | null;
  fuelType: string | null;
  transmission: string | null;
  type: string | null;
};

type TopTermRow = {
  termKey: string;
  termValue: string;
  score: number;
  searchCount: number | null;
  openCount: number | null;
  contactCount: number | null;
  impressionCount: number | null;
  dateUpdated: Date | string | null;
  lastEventAt: Date | string | null;
};

const MAX_VISITOR_ID_LENGTH = 255;
const MAX_TERM_KEY_LENGTH = 64;
const MAX_TERM_VALUE_LENGTH = 255;
const MAX_TERM_SCORE = 500;
const SCORE_DECAY_ON_WRITE = 0.98;

const FIELD_WEIGHTS: Record<string, number> = {
  model: 3,
  make: 2,
  bodyType: 1.5,
  fuelType: 1,
  transmission: 1,
  type: 1,
  keyword: 1,
  generalSearch: 1,
};

const EVENT_MULTIPLIERS: Record<PersonalizationEvent, number> = {
  search: 1,
  open: 3,
  contact: 6,
  impression: 1,
};

@Injectable()
export class PersonalizationService {
  private readonly logger = createLogger('personalization-service');

  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return String(process.env.PERSONALIZATION_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  isPersonalizationDisabled(raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }
    return false;
  }

  sanitizeVisitorId(visitorId?: unknown): string | null {
    if (typeof visitorId !== 'string') return null;
    const normalized = visitorId.trim();
    if (!normalized) return null;
    return normalized.slice(0, MAX_VISITOR_ID_LENGTH);
  }

  async getTopTerms(
    visitorId: unknown,
    limit = 40,
  ): Promise<PersonalizationTermScore[]> {
    if (!this.isEnabled()) return [];
    const sanitizedVisitorId = this.sanitizeVisitorId(visitorId);
    if (!sanitizedVisitorId) return [];

    const visitorHash = this.hashVisitorId(sanitizedVisitorId);
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(100, Math.floor(limit)))
      : 40;

    const rows = await this.prisma.$queryRawUnsafe<TopTermRow[]>(
      `SELECT term_key AS termKey,
              term_value AS termValue,
              score,
              search_count AS searchCount,
              open_count AS openCount,
              contact_count AS contactCount,
              impression_count AS impressionCount,
              dateUpdated,
              last_event_at AS lastEventAt
       FROM visitor_interest_term
       WHERE visitor_hash = ?
       ORDER BY score DESC, dateUpdated DESC
       LIMIT ?`,
      visitorHash,
      safeLimit,
    );

    return rows
      .map((row) => ({
        termKey: this.normalizeTermKey(row.termKey),
        termValue: this.normalizeTermValue(row.termValue),
        score: Number(row.score ?? 0),
        searchCount: this.toNonNegativeInt(row.searchCount),
        openCount: this.toNonNegativeInt(row.openCount),
        contactCount: this.toNonNegativeInt(row.contactCount),
        impressionCount: this.toNonNegativeInt(row.impressionCount),
        dateUpdated: this.toDateOrNull(row.dateUpdated),
        lastEventAt: this.toDateOrNull(row.lastEventAt),
      }))
      .filter((row) => row.termKey.length > 0 && row.termValue.length > 0 && row.score > 0);
  }

  async resetVisitorProfile(visitorId: unknown): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const sanitizedVisitorId = this.sanitizeVisitorId(visitorId);
    if (!sanitizedVisitorId) return false;

    const visitorHash = this.hashVisitorId(sanitizedVisitorId);
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM visitor_profile WHERE visitor_hash = ?',
      visitorHash,
    );
    return true;
  }

  async cleanupInactiveProfiles(retentionDays = this.getRetentionDays()): Promise<number> {
    if (!this.isEnabled()) return 0;

    const safeRetention = Number.isFinite(retentionDays)
      ? Math.max(1, Math.floor(retentionDays))
      : 90;

    const deletedRows = await this.prisma.$executeRawUnsafe(
      `DELETE FROM visitor_profile
       WHERE lastSeenAt < DATE_SUB(NOW(), INTERVAL ${safeRetention} DAY)`,
    );

    return Number(deletedRows ?? 0);
  }

  async recordSearchSignal(filter: SearchFilter): Promise<void> {
    if (!this.isEnabled() || this.isPersonalizationDisabled(filter.personalizationDisabled)) {
      return;
    }

    const sanitizedVisitorId = this.sanitizeVisitorId(filter.visitorId);
    if (!sanitizedVisitorId) return;

    const visitorHash = this.hashVisitorId(sanitizedVisitorId);
    const terms = this.buildSearchTerms(filter);

    if (terms.length === 0) {
      await this.touchProfile(visitorHash);
      return;
    }

    await this.incrementTerms(visitorHash, terms);
  }

  async recordPostSignalByPostId(
    postId: bigint | number | string,
    visitorId: unknown,
    event: PersonalizationEvent,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const sanitizedVisitorId = this.sanitizeVisitorId(visitorId);
    if (!sanitizedVisitorId) return;

    const visitorHash = this.hashVisitorId(sanitizedVisitorId);
    const safePostId = typeof postId === 'bigint' ? postId.toString() : String(postId);

    if (!/^\d+$/.test(safePostId)) {
      return;
    }

    const rows = await this.prisma.$queryRawUnsafe<PostSignalRow[]>(
      `SELECT make, model, bodyType, fuelType, transmission, type
       FROM search
       WHERE id = ?
       LIMIT 1`,
      safePostId,
    );

    const row = rows[0];
    if (!row) {
      await this.touchProfile(visitorHash);
      return;
    }

    const terms = this.buildPostTerms(row, event);
    if (terms.length === 0) {
      await this.touchProfile(visitorHash);
      return;
    }

    await this.incrementTerms(visitorHash, terms);
  }

  private async touchProfile(visitorHash: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO visitor_profile (visitor_hash, dateCreated, dateUpdated, lastSeenAt)
       VALUES (?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         dateUpdated = NOW(),
         lastSeenAt = NOW()`,
      visitorHash,
    );
  }

  private async incrementTerms(visitorHash: string, terms: WeightedTerm[]): Promise<void> {
    await this.touchProfile(visitorHash);

    for (const term of terms) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO visitor_interest_term
          (visitor_hash, term_key, term_value, score, search_count, open_count, contact_count, impression_count, last_event_at, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           score = LEAST(?, (score * ?) + VALUES(score)),
           search_count = search_count + VALUES(search_count),
           open_count = open_count + VALUES(open_count),
           contact_count = contact_count + VALUES(contact_count),
           impression_count = impression_count + VALUES(impression_count),
           last_event_at = NOW(),
           dateUpdated = NOW()`,
        visitorHash,
        term.termKey,
        term.termValue,
        term.delta,
        term.counters.searchCount,
        term.counters.openCount,
        term.counters.contactCount,
        term.counters.impressionCount,
        MAX_TERM_SCORE,
        SCORE_DECAY_ON_WRITE,
      );
    }
  }

  private buildSearchTerms(filter: SearchFilter): WeightedTerm[] {
    const weightedTerms = new Map<string, WeightedTerm>();
    const searchTerms = Array.isArray(filter.searchTerms) ? filter.searchTerms : [];
    const eventMultiplier = EVENT_MULTIPLIERS.search;

    const add = (termKey: string, raw: unknown, fieldKey: keyof typeof FIELD_WEIGHTS) => {
      const values = this.valuesFromRaw(raw);
      for (const value of values) {
        const normalizedValue = this.normalizeTermValue(value);
        const normalizedKey = this.normalizeTermKey(termKey);
        if (!normalizedKey || !normalizedValue) continue;
        const mapKey = `${normalizedKey}::${normalizedValue}`;
        const delta = FIELD_WEIGHTS[fieldKey] * eventMultiplier;
        const counters = this.countersForEvent('search');
        const existing = weightedTerms.get(mapKey);
        if (existing) {
          existing.delta += delta;
          existing.counters = this.mergeCounters(existing.counters, counters);
        } else {
          weightedTerms.set(mapKey, {
            termKey: normalizedKey,
            termValue: normalizedValue,
            delta,
            counters,
          });
        }
      }
    };

    add('type', filter.type, 'type');

    for (const term of searchTerms) {
      if (!term || typeof term.key !== 'string') continue;
      const key = term.key;

      switch (key) {
        case 'make1':
          add('make', term.value, 'make');
          break;
        case 'model1':
          add('model', term.value, 'model');
          break;
        case 'bodyType':
          add('bodyType', term.value, 'bodyType');
          break;
        case 'fuelType':
          add('fuelType', term.value, 'fuelType');
          break;
        case 'transmission':
          add('transmission', term.value, 'transmission');
          break;
        default:
          break;
      }
    }

    add('keyword', filter.keyword, 'keyword');
    add('generalSearch', filter.generalSearch, 'generalSearch');

    return Array.from(weightedTerms.values());
  }

  private buildPostTerms(row: PostSignalRow, event: PersonalizationEvent): WeightedTerm[] {
    const weightedTerms = new Map<string, WeightedTerm>();
    const eventMultiplier = EVENT_MULTIPLIERS[event];

    const add = (termKey: string, raw: unknown, fieldKey: keyof typeof FIELD_WEIGHTS) => {
      const values = this.valuesFromRaw(raw);
      for (const value of values) {
        const normalizedValue = this.normalizeTermValue(value);
        const normalizedKey = this.normalizeTermKey(termKey);
        if (!normalizedKey || !normalizedValue) continue;

        const mapKey = `${normalizedKey}::${normalizedValue}`;
        const delta = FIELD_WEIGHTS[fieldKey] * eventMultiplier;
        const counters = this.countersForEvent(event);
        const existing = weightedTerms.get(mapKey);
        if (existing) {
          existing.delta += delta;
          existing.counters = this.mergeCounters(existing.counters, counters);
        } else {
          weightedTerms.set(mapKey, {
            termKey: normalizedKey,
            termValue: normalizedValue,
            delta,
            counters,
          });
        }
      }
    };

    add('make', row.make, 'make');
    add('model', row.model, 'model');
    add('bodyType', row.bodyType, 'bodyType');
    add('fuelType', row.fuelType, 'fuelType');
    add('transmission', row.transmission, 'transmission');
    add('type', row.type, 'type');

    return Array.from(weightedTerms.values());
  }

  private countersForEvent(event: PersonalizationEvent): EventCounters {
    switch (event) {
      case 'search':
        return {
          searchCount: 1,
          openCount: 0,
          contactCount: 0,
          impressionCount: 0,
        };
      case 'open':
        return {
          searchCount: 0,
          openCount: 1,
          contactCount: 0,
          impressionCount: 0,
        };
      case 'contact':
        return {
          searchCount: 0,
          openCount: 0,
          contactCount: 1,
          impressionCount: 0,
        };
      case 'impression':
        return {
          searchCount: 0,
          openCount: 0,
          contactCount: 0,
          impressionCount: 1,
        };
      default:
        return {
          searchCount: 0,
          openCount: 0,
          contactCount: 0,
          impressionCount: 0,
        };
    }
  }

  private mergeCounters(base: EventCounters, delta: EventCounters): EventCounters {
    return {
      searchCount: base.searchCount + delta.searchCount,
      openCount: base.openCount + delta.openCount,
      contactCount: base.contactCount + delta.contactCount,
      impressionCount: base.impressionCount + delta.impressionCount,
    };
  }

  private valuesFromRaw(raw: unknown): string[] {
    if (raw == null) return [];

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const range = raw as { from?: unknown; to?: unknown };
      return [range.from, range.to]
        .map((value) => this.normalizeTermValue(value))
        .filter((value): value is string => Boolean(value));
    }

    const value = String(raw).trim();
    if (!value) return [];

    return value
      .split(',')
      .map((entry) => this.normalizeTermValue(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  private normalizeTermKey(raw: unknown): string {
    const normalized = String(raw ?? '').trim();
    if (!normalized) return '';
    return normalized.slice(0, MAX_TERM_KEY_LENGTH);
  }

  private normalizeTermValue(raw: unknown): string {
    const normalized = String(raw ?? '')
      .replace(' (all)', '')
      .trim();
    if (!normalized) return '';
    return normalized.slice(0, MAX_TERM_VALUE_LENGTH);
  }

  private getRetentionDays(): number {
    const parsed = Number(process.env.PERSONALIZATION_RETENTION_DAYS ?? '90');
    if (!Number.isFinite(parsed)) return 90;
    return Math.max(1, Math.floor(parsed));
  }

  private toNonNegativeInt(value: unknown): number {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.trunc(numericValue));
  }

  private toDateOrNull(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private hashVisitorId(visitorId: string): string {
    return createHash('sha256').update(visitorId).digest('hex');
  }
}
