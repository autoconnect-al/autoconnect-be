import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { decodeCaption } from '../imports/utils/caption-processor';
import { createLogger } from '../../common/logger.util';
import {
  LegacySearchQueryBuilder,
  type FilterTerm,
  type SearchFilter,
} from './legacy-search-query-builder';
import {
  PersonalizationService,
  type PersonalizationTermScore,
} from '../personalization/personalization.service';

@Injectable()
export class LegacySearchService {
  private readonly skipQuickSearchFix = new Set(['benz', 'mercedes']);
  private readonly logger = createLogger('legacy-search-service');
  private readonly queryBudgetsMs: Record<string, number> = {
    search: 350,
    search_promoted: 220,
    result_count: 180,
    price_calculate: 350,
    most_wanted: 200,
    post_detail: 120,
    caption: 150,
    related_by_id: 220,
    related_by_filter: 220,
    resolve_model: 120,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilder: LegacySearchQueryBuilder,
    private readonly personalizationService?: PersonalizationService,
  ) {}

  async search(filterRaw: string | undefined) {
    const filter = this.queryBuilder.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while searching for cars', 500);
    }
    const shouldApplyPersonalization =
      this.shouldApplySearchPersonalization(filter);
    const personalizationTerms = shouldApplyPersonalization
      ? ((await this.personalizationService?.getTopTerms(filter.visitorId)) ??
        [])
      : [];

    const promoted = await this.findPromotedSearchPost(filter);
    const { whereSql, params } = this.queryBuilder.buildWhere(filter);
    const { limit, offset } = this.queryBuilder.buildSortAndPagination(filter);
    const personalizedSort = this.buildPersonalizedSearchOrder(personalizationTerms);
    const orderSql = personalizedSort.orderSql
      ?? this.queryBuilder.buildSortAndPagination(filter).orderSql;

    const rows = await this.timeQuery('search', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM search ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
        ...params,
        ...personalizedSort.orderParams,
        limit,
        offset,
      ),
    );

    const recordSignalPromise =
      this.personalizationService?.recordSearchSignal(filter);
    void recordSignalPromise?.catch((error) =>
        this.logger.warn('personalization.search-signal.failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );

    const merged = this.mergeRowsWithPromoted(rows, promoted);
    return legacySuccess(
      this.normalizeBigInts(
        this.annotateRowsWithPromotion(merged, promoted),
      ),
    );
  }

  async countResults(filterRaw: string | undefined) {
    const filter = this.queryBuilder.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while counting results', 500);
    }
    const { whereSql, params } = this.queryBuilder.buildWhere(filter);
    const rows = await this.timeQuery('result_count', () =>
      this.prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) as total FROM search ${whereSql}`,
        ...params,
      ),
    );
    const count = Number(rows[0]?.total ?? 0);
    return legacySuccess(count);
  }

  async priceCalculate(filterRaw: string | undefined) {
    const filter = this.queryBuilder.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while searching for cars', 500);
    }

    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '');
    const registrationRaw = terms.get('registration');
    const fuelType = this.toStr(terms.get('fuelType') ?? '');
    const bodyType = this.toStr(terms.get('bodyType') ?? '');
    const transmission = this.toStr(terms.get('transmission') ?? '');

    const registrationFrom =
      this.queryBuilder.extractRegistrationFrom(registrationRaw);
    if (!make || !model || !registrationFrom || !fuelType) {
      return legacySuccess([]);
    }

    const modelResolution = await this.resolveModel(make, model);

    const where: string[] = [
      'CAST(p.createdTime AS UNSIGNED) > ?',
      'cd.price > 0',
      'cd.make = ?',
      '(cd.customsPaid = 1 OR cd.customsPaid IS NULL)',
      'cd.registration >= ?',
      'cd.registration <= ?',
      'cd.fuelType = ?',
    ];
    const params: unknown[] = [
      Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60,
      make,
      String(registrationFrom - 2),
      String(registrationFrom + 2),
      fuelType,
    ];

    if (modelResolution.isVariant) {
      where.push('(cd.variant LIKE ? OR cd.variant LIKE ?)');
      params.push(
        `% ${modelResolution.variant} %`,
        `${modelResolution.model}%`,
      );
    } else {
      where.push('cd.model = ?');
      params.push(modelResolution.model.replace(' (all)', ''));
    }

    if (transmission) {
      where.push('cd.transmission = ?');
      params.push(transmission);
    }
    if (bodyType) {
      where.push('cd.bodyType = ?');
      params.push(bodyType);
    }

    const rows = await this.timeQuery('price_calculate', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT cd.price, cd.make, cd.model, cd.variant, cd.registration, p.id
       FROM post p
       LEFT JOIN car_detail cd ON cd.post_id = p.id
       WHERE ${where.join(' AND ')}`,
        ...params,
      ),
    );

    return legacySuccess(this.normalizeBigInts(rows));
  }

  async mostWanted(
    excludeIds?: string,
    excludedAccounts?: string,
    visitorId?: string,
    personalizationDisabled?: boolean | string | number,
  ) {
    const excludeIdValues = this.queryBuilder.parseCsvValues(excludeIds);
    const excludeAccountValues = this.queryBuilder.parseCsvValues(excludedAccounts);

    const recencyDays = this.getMostWantedRecencyDays();
    const clauses: string[] = [
      's.sold = 0',
      "(s.deleted = '0' OR s.deleted = 0)",
      'p.deleted = 0',
    ];
    const params: unknown[] = [];
    if (recencyDays > 0) {
      const recencyWindow = new Date(
        Date.now() - recencyDays * 24 * 60 * 60 * 1000,
      );
      clauses.push('p.dateCreated > ?');
      params.push(recencyWindow);
    }
    if (excludeIdValues.length > 0) {
      clauses.push(`s.id NOT IN (${excludeIdValues.map(() => '?').join(',')})`);
      params.push(...excludeIdValues);
    }
    if (excludeAccountValues.length > 0) {
      clauses.push(
        `s.accountName NOT IN (${excludeAccountValues.map(() => '?').join(',')})`,
      );
      params.push(...excludeAccountValues);
    }

    const shouldApplyPersonalization =
      this.shouldApplyMostWantedPersonalization(
        visitorId,
        personalizationDisabled,
      );
    const personalizationTerms = shouldApplyPersonalization
      ? ((await this.personalizationService?.getTopTerms(visitorId)) ?? [])
      : [];
    const personalizedSort = this.buildPersonalizedMostWantedOrder(personalizationTerms);
    const orderSql =
      personalizedSort.orderSql ?? 'ORDER BY s.mostWantedTo DESC, p.clicks DESC';

    const query = `SELECT s.id, s.make, s.model, s.variant, s.registration, s.mileage, s.price, s.transmission, s.fuelType, s.engineSize, s.drivetrain, s.seats, s.numberOfDoors, s.bodyType, s.customsPaid, s.canExchange, s.options, s.emissionGroup, s.type, s.accountName, s.sidecarMedias, s.contact, s.vendorContact, s.profilePicture, s.vendorId, s.promotionTo, s.highlightedTo, s.renewTo, s.renewInterval, s.renewedTime, s.mostWantedTo
      FROM search s
      INNER JOIN post p ON p.id = s.id
      WHERE ${clauses.join(' AND ')}
      ${orderSql}
      LIMIT 4`;
    const rows = await this.timeQuery('most_wanted', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        query,
        ...params,
        ...personalizedSort.orderParams,
      ),
    );
    return legacySuccess(this.normalizeBigInts(this.withCarDetail(rows)));
  }

  async getCarDetails(id: string) {
    const rows = await this.timeQuery('post_detail', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        'SELECT * FROM search WHERE id = ? LIMIT 1',
        id,
      ),
    );
    if (rows.length === 0) {
      return legacyError('Car details not found', 404);
    }
    return legacySuccess(this.normalizeBigInts(rows));
  }

  async getCaption(id: string) {
    const rows = await this.timeQuery('caption', () =>
      this.prisma.$queryRawUnsafe<
        Array<{ cleanedCaption: string | null; sidecarMedias: unknown }>
      >(
        'SELECT cleanedCaption, sidecarMedias FROM search WHERE id = ? LIMIT 1',
        id,
      ),
    );
    if (rows.length === 0) {
      return legacyError('Car details not found', 404);
    }
    const first = rows[0] ?? { cleanedCaption: null, sidecarMedias: null };
    const cleanedCaption = this.normalizeCaption(first.cleanedCaption ?? '');
    const mediaUrl = await this.resolveCaptionMedia(first.sidecarMedias);
    return legacySuccess({ cleanedCaption, mediaUrl });
  }

  async relatedById(id: string, type = 'car', excludedIds?: string) {
    const row = await this.timeQuery('related_by_id', () =>
      this.prisma.$queryRawUnsafe<
        Array<{
          make: string | null;
          model: string | null;
          registration: string | null;
          fuelType: string | null;
          bodyType: string | null;
        }>
      >(
        'SELECT make, model, registration, fuelType, bodyType FROM search WHERE id = ? LIMIT 1',
        id,
      ),
    );
    const make = row[0]?.make;
    const model = row[0]?.model;
    if (!make || !model) {
      return legacySuccess([]);
    }

    const excludedValues = this.queryBuilder
      .parseCsvValues(excludedIds)
      .filter((value) => value !== id);
    excludedValues.push(id);
    const promoted = await this.findPromotedRelatedPost(
      {
        make,
        model,
        registration: row[0]?.registration ?? null,
        fuelType: row[0]?.fuelType ?? null,
        bodyType: row[0]?.bodyType ?? null,
      },
      type,
      excludedValues,
    );
    if (promoted && promoted.id != null) {
      excludedValues.push(String(promoted.id));
    }

    const limit = Math.max(0, 4 - (promoted ? 1 : 0));
    const excludedClause =
      excludedValues.length > 0
        ? `AND id NOT IN (${excludedValues.map(() => '?').join(',')})`
        : '';
    const params: unknown[] = [make, model, type, ...excludedValues, limit];
    const rows = await this.timeQuery('related_by_id', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT id, make, model, variant, registration, mileage, price, transmission, fuelType, engineSize, drivetrain, seats, numberOfDoors, bodyType, customsPaid, canExchange, options, emissionGroup, type, sidecarMedias, accountName, profilePicture, vendorId, contact, vendorContact, promotionTo, highlightedTo, renewTo, renewInterval, renewedTime, mostWantedTo
       FROM search WHERE make = ? AND model = ? AND sold = 0 AND deleted = '0' AND type = ? ${excludedClause} ORDER BY dateUpdated DESC, id DESC LIMIT ?`,
        ...params,
      ),
    );
    return legacySuccess(
      this.normalizeBigInts(
        this.annotateRelatedRows(this.withCarDetail(rows), promoted),
      ),
    );
  }

  async relatedByFilter(
    filterRaw: string | undefined,
    type = 'car',
    excludedIds?: string,
  ) {
    const filter = this.queryBuilder.parseFilter(filterRaw);
    if (!filter) {
      return legacyError(
        'An error occurred while getting related searches',
        500,
      );
    }

    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '');
    const registration = this.toStr(terms.get('registration') ?? '');
    const fuelType = this.toStr(terms.get('fuelType') ?? '');
    const bodyType = this.toStr(terms.get('bodyType') ?? '');
    const excludedValues = this.queryBuilder.parseCsvValues(excludedIds);
    const promoted = await this.findPromotedRelatedPost(
      {
        make: make || null,
        model: model.replace(' (all)', '') || null,
        registration: registration || null,
        fuelType: fuelType || null,
        bodyType: bodyType || null,
      },
      type,
      excludedValues,
    );
    if (promoted && promoted.id != null) {
      excludedValues.push(String(promoted.id));
    }
    const limit = Math.max(0, 4 - (promoted ? 1 : 0));
    const excludedClause =
      excludedValues.length > 0
        ? `AND id NOT IN (${excludedValues.map(() => '?').join(',')})`
        : '';

    const params: unknown[] = [type, ...excludedValues];
    let where = `sold = 0 AND deleted = '0' AND type = ? ${excludedClause}`;
    if (make) {
      where += ' AND make = ?';
      params.push(make);
    }
    if (model) {
      where += ' AND model = ?';
      params.push(model.replace(' (all)', ''));
    }

    const rows = await this.timeQuery('related_by_filter', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT id, make, model, variant, registration, mileage, price, transmission, fuelType, engineSize, drivetrain, seats, numberOfDoors, bodyType, customsPaid, canExchange, options, emissionGroup, type, sidecarMedias, accountName, profilePicture, vendorId, contact, vendorContact, promotionTo, highlightedTo, renewTo, renewInterval, renewedTime, mostWantedTo
       FROM search WHERE ${where} ORDER BY dateUpdated DESC, id DESC LIMIT ?`,
        ...params,
        limit,
      ),
    );
    return legacySuccess(
      this.normalizeBigInts(
        this.annotateRelatedRows(this.withCarDetail(rows), promoted),
      ),
    );
  }

  private async findPromotedRelatedPost(
    context: {
      make: string | null;
      model: string | null;
      registration: string | null;
      fuelType: string | null;
      bodyType: string | null;
    },
    type: string,
    excludedIds: string[],
  ): Promise<Record<string, unknown> | null> {
    const now = Math.floor(Date.now() / 1000);
    const baseWhereParts = [
      'sold = 0',
      "deleted = '0'",
      'type = ?',
      'promotionTo IS NOT NULL',
      'promotionTo >= ?',
    ];
    const baseParams: unknown[] = [type, now];
    if (excludedIds.length > 0) {
      baseWhereParts.push(`id NOT IN (${excludedIds.map(() => '?').join(',')})`);
      baseParams.push(...excludedIds);
    }

    const rankCase = this.buildPromotedRankCaseSql(context);
    const rankParams = this.buildPromotedRankParams(context);
    const tierClauses: string[] = [];
    const tierParams: unknown[] = [];

    if (context.make && context.model) {
      tierClauses.push('(make = ? AND model = ?)');
      tierParams.push(context.make, context.model);
    }
    if (context.make && context.model && context.registration) {
      tierClauses.push('(make = ? AND model = ? AND registration = ?)');
      tierParams.push(context.make, context.model, context.registration);
    }
    if (context.make && context.model && context.registration && context.fuelType) {
      tierClauses.push(
        '(make = ? AND model = ? AND registration = ? AND fuelType = ?)',
      );
      tierParams.push(
        context.make,
        context.model,
        context.registration,
        context.fuelType,
      );
    }
    if (context.bodyType) {
      tierClauses.push('(bodyType = ?)');
      tierParams.push(context.bodyType);
    }

    const select = `SELECT id, make, model, variant, registration, mileage, price, transmission, fuelType, engineSize, drivetrain, seats, numberOfDoors, bodyType, customsPaid, canExchange, options, emissionGroup, type, sidecarMedias, accountName, profilePicture, vendorId, contact, vendorContact, promotionTo, highlightedTo, renewTo, renewInterval, renewedTime, mostWantedTo
       FROM search`;

    if (tierClauses.length > 0) {
      const matchRows = await this.timeQuery('related_by_filter', () =>
        this.prisma.$queryRawUnsafe<unknown[]>(
          `${select} WHERE ${baseWhereParts.join(' AND ')} AND (${tierClauses.join(' OR ')})
         ORDER BY ${rankCase} DESC, promotionTo DESC, dateUpdated DESC, id DESC LIMIT 1`,
          ...baseParams,
          ...tierParams,
          ...rankParams,
        ),
      );
      if (matchRows.length > 0) {
        return this.withCarDetail(matchRows)[0] as Record<string, unknown>;
      }
    }

    const fallbackRows = await this.timeQuery('related_by_filter', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `${select} WHERE ${baseWhereParts.join(' AND ')}
         ORDER BY promotionTo DESC, dateUpdated DESC, id DESC LIMIT 1`,
        ...baseParams,
      ),
    );
    if (fallbackRows.length === 0) {
      return null;
    }
    return this.withCarDetail(fallbackRows)[0] as Record<string, unknown>;
  }

  private async findPromotedSearchPost(
    filter: SearchFilter,
  ): Promise<Record<string, unknown> | null> {
    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '').replace(' (all)', '');
    const registrationRaw = terms.get('registration');
    const registration =
      registrationRaw && typeof registrationRaw === 'object'
        ? this.toStr((registrationRaw as Record<string, unknown>).from ?? '')
        : this.toStr(registrationRaw ?? '');
    const fuelType = this.toStr(terms.get('fuelType') ?? '');
    const bodyType = this.toStr(terms.get('bodyType') ?? '');
    const type = this.toStr(filter.type ?? '') || 'car';

    const now = Math.floor(Date.now() / 1000);
    const baseWhereParts = [
      'sold = 0',
      "deleted = '0'",
      'type = ?',
      'promotionTo IS NOT NULL',
      'promotionTo >= ?',
    ];
    const baseParams: unknown[] = [type, now];
    const rankContext = {
      make: make || null,
      model: model || null,
      registration: registration || null,
      fuelType: fuelType || null,
      bodyType: bodyType || null,
    };
    const rankCase = this.buildPromotedRankCaseSql(rankContext);
    const rankParams = this.buildPromotedRankParams(rankContext);
    const tierClauses: string[] = [];
    const tierParams: unknown[] = [];

    if (make && model) {
      tierClauses.push('(make = ? AND model = ?)');
      tierParams.push(make, model);
    }
    if (make && model && registration) {
      tierClauses.push('(make = ? AND model = ? AND registration = ?)');
      tierParams.push(make, model, registration);
    }
    if (make && model && registration && fuelType) {
      tierClauses.push(
        '(make = ? AND model = ? AND registration = ? AND fuelType = ?)',
      );
      tierParams.push(make, model, registration, fuelType);
    }
    if (bodyType) {
      tierClauses.push('(bodyType = ?)');
      tierParams.push(bodyType);
    }

    if (tierClauses.length > 0) {
      const matched = await this.timeQuery('search_promoted', () =>
        this.prisma.$queryRawUnsafe<unknown[]>(
          `SELECT * FROM search
           WHERE ${baseWhereParts.join(' AND ')} AND (${tierClauses.join(' OR ')})
           ORDER BY ${rankCase} DESC, promotionTo DESC, dateUpdated DESC, id DESC
           LIMIT 1`,
          ...baseParams,
          ...tierParams,
          ...rankParams,
        ),
      );
      if (matched.length > 0) {
        return (matched[0] as Record<string, unknown>) ?? null;
      }
    }

    const fallback = await this.timeQuery('search_promoted', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM search
         WHERE ${baseWhereParts.join(' AND ')}
         ORDER BY promotionTo DESC, dateUpdated DESC, id DESC
         LIMIT 1`,
        ...baseParams,
      ),
    );
    return (fallback[0] as Record<string, unknown>) ?? null;
  }

  private buildPromotedRankCaseSql(context: {
    make: string | null;
    model: string | null;
    registration: string | null;
    fuelType: string | null;
    bodyType: string | null;
  }): string {
    const clauses: string[] = [];
    if (context.make && context.model && context.registration && context.fuelType) {
      clauses.push('WHEN make = ? AND model = ? AND registration = ? AND fuelType = ? THEN 4');
    }
    if (context.make && context.model && context.registration) {
      clauses.push('WHEN make = ? AND model = ? AND registration = ? THEN 3');
    }
    if (context.make && context.model) {
      clauses.push('WHEN make = ? AND model = ? THEN 2');
    }
    if (context.bodyType) {
      clauses.push('WHEN bodyType = ? THEN 1');
    }
    if (clauses.length === 0) {
      return '0';
    }
    return `CASE ${clauses.join(' ')} ELSE 0 END`;
  }

  private buildPromotedRankParams(context: {
    make: string | null;
    model: string | null;
    registration: string | null;
    fuelType: string | null;
    bodyType: string | null;
  }): unknown[] {
    const params: unknown[] = [];
    if (context.make && context.model && context.registration && context.fuelType) {
      params.push(
        context.make,
        context.model,
        context.registration,
        context.fuelType,
      );
    }
    if (context.make && context.model && context.registration) {
      params.push(context.make, context.model, context.registration);
    }
    if (context.make && context.model) {
      params.push(context.make, context.model);
    }
    if (context.bodyType) {
      params.push(context.bodyType);
    }
    return params;
  }

  private parseFilter(filterRaw: string | undefined): SearchFilter | null {
    return this.queryBuilder.parseFilter(filterRaw);
  }

  private extractRegistrationFrom(registrationRaw: unknown): number | null {
    return this.queryBuilder.extractRegistrationFrom(registrationRaw);
  }

  private async resolveModel(
    make: string,
    model: string,
  ): Promise<{ model: string; variant: string; isVariant: boolean }> {
    const rows = await this.timeQuery('resolve_model', () =>
      this.prisma.$queryRawUnsafe<
        Array<{ Model: string | null; isVariant: boolean | number | null }>
      >('SELECT Model, isVariant FROM car_make_model WHERE Make = ?', make),
    );

    const normalizedInput = this.normalizeModelToken(model);
    for (const row of rows) {
      const dbModel = this.toStr(row.Model ?? '');
      if (!dbModel) continue;
      const normalizedDb = this.normalizeModelToken(dbModel);
      if (
        normalizedDb.includes(normalizedInput) &&
        normalizedInput.includes(normalizedDb)
      ) {
        return {
          model: dbModel,
          variant: dbModel,
          isVariant: Boolean(row.isVariant),
        };
      }
    }

    const fallback = model.replace(/-/g, ' ');
    return { model: fallback, variant: fallback, isVariant: false };
  }

  private normalizeModelToken(value: string): string {
    return value.replace(/\s+/g, '-').toLowerCase();
  }

  private normalizeCaption(caption: string): string {
    if (!caption) return '';
    return caption
      .replace(/ ,/g, ',')
      .replace(/ !/g, '!')
      .replace(/ - /g, '-')
      .replace(/ : /g, ':')
      .replace(/: /g, ':')
      .replace(/ :/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async resolveCaptionMedia(
    sidecarMedias: unknown,
  ): Promise<string | null> {
    const source = this.firstSidecarThumbnail(sidecarMedias);
    if (!source) return null;

    const jpg = this.toJpgUrlIfWebp(source);
    if (jpg !== source) {
      const exists = await this.urlExists(jpg);
      if (exists) return jpg;
    }
    return source;
  }

  private firstSidecarThumbnail(sidecarMedias: unknown): string | null {
    let parsed: unknown = sidecarMedias;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = (parsed as unknown[])[0];
    if (!first || typeof first !== 'object') return null;
    const candidate = (first as Record<string, unknown>).imageThumbnailUrl;
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate
      : null;
  }

  private toJpgUrlIfWebp(url: string): string {
    return url.replace(/\.webp(\?.*)?$/i, '.jpg$1');
  }

  private async urlExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildSortAndPagination(filter: SearchFilter) {
    return this.queryBuilder.buildSortAndPagination(filter);
  }

  private buildWhere(filter: SearchFilter) {
    return this.queryBuilder.buildWhere(filter);
  }

  private applyKeywordClauses(
    clauses: string[],
    params: unknown[],
    keyword: string,
    isVendorSearch: boolean,
  ) {
    const options = keyword
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!keyword) {
      if (!isVendorSearch) {
        clauses.push('(vendorId != 1 OR vendorId IS NULL)');
      }
      return;
    }

    if (keyword === 'encar') {
      clauses.push('vendorId = 1');
    } else {
      clauses.push('(vendorId != 1 OR vendorId IS NULL)');
    }

    const hasOfferKeyword = options.some(
      (option) => option === 'okazion' || option === 'oferte',
    );
    if (hasOfferKeyword) {
      clauses.push('price > 1');
      clauses.push('minPrice > 1');
      clauses.push('maxPrice > 1');
      clauses.push('((price - minPrice) / (maxPrice - price) < 0.25)');
      const remainingOptions = options.filter(
        (option) => option !== 'okazion' && option !== 'oferte',
      );
      if (remainingOptions.length > 0) {
        clauses.push(
          `(${remainingOptions.map(() => 'cleanedCaption LIKE ?').join(' OR ')})`,
        );
        for (const option of remainingOptions) {
          params.push(`%${option}%`);
        }
      }
      return;
    }

    if (keyword === 'retro') {
      clauses.push('(cleanedCaption LIKE ? OR registration < ?)');
      params.push('%retro%', String(new Date().getFullYear() - 30));
      return;
    }

    if (keyword === 'korea') {
      clauses.push('(cleanedCaption LIKE ? OR accountName LIKE ?)');
      params.push('%korea%', '%korea%');
      return;
    }

    if (keyword !== 'elektrike') {
      if (options.length > 0) {
        clauses.push(
          `(${options.map(() => 'cleanedCaption LIKE ?').join(' OR ')})`,
        );
        for (const option of options) {
          params.push(`%${option}%`);
        }
      }
    }
  }

  private applyGeneralSearchClauses(
    clauses: string[],
    params: unknown[],
    generalSearch: string,
  ) {
    const normalizedInput = generalSearch.replace(/,/g, ' ').trim();
    if (!normalizedInput) return;
    if (normalizedInput.length > 75) return;

    const tokens = this.normalizeGeneralSearchTokens(normalizedInput).slice(
      0,
      10,
    );
    if (tokens.length === 0) return;

    for (const token of tokens) {
      clauses.push(
        '(cleanedCaption LIKE ? OR make LIKE ? OR model LIKE ? OR variant LIKE ? OR registration LIKE ? OR fuelType LIKE ?)',
      );
      const value = `%${token}%`;
      params.push(value, value, value, value, value, value);
    }
  }

  private normalizeGeneralSearchTokens(input: string): string[] {
    let tokens = input
      .split(' ')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    tokens = tokens.map((token) => {
      if (token === 'benc') return 'benz';
      if (token === 'mercedez') return 'mercedes';
      if (token === 'seri' || token === 'seria' || token === 'serija') {
        return 'series';
      }
      if (token === 'klas' || token === 'klasa' || token === 'clas') {
        return 'class';
      }
      return token;
    });

    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === 't' && tokens[i + 1] === 'max') {
        tokens[i] = 'tmax';
        tokens.splice(i + 1, 1);
      }
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === 'series') {
        const tmp = tokens[i];
        tokens[i] = tokens[i + 1];
        tokens[i + 1] = tmp;
      }
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      const current = tokens[i];
      const next = tokens[i + 1];
      if (
        current.length === 1 &&
        !this.isNumeric(current) &&
        !this.skipQuickSearchFix.has(current)
      ) {
        tokens[i] = this.isNumeric(next)
          ? `${current} ${next}`
          : `${current}-${next}`;
        tokens.splice(i + 1, 1);
        i--;
      }
    }

    for (let i = 1; i < tokens.length; i++) {
      const current = tokens[i];
      const prev = tokens[i - 1];
      if (
        this.isNumeric(current) &&
        !this.isNumeric(prev) &&
        !prev.includes('-') &&
        !this.skipQuickSearchFix.has(prev) &&
        !current.includes('.')
      ) {
        tokens[i - 1] =
          prev === 'golf' ? `${prev} ${current}` : `${prev}-${current}`;
        tokens.splice(i, 1);
        i--;
      }
    }

    return tokens;
  }

  private isNumeric(value: string): boolean {
    if (!value) return false;
    return !Number.isNaN(Number(value));
  }

  private addInClause(
    clauses: string[],
    params: unknown[],
    key: string,
    raw: unknown,
  ) {
    const value = this.toStr(raw ?? '');
    if (!value) return;
    const values = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        if (
          !v.toLowerCase().includes('suv') &&
          !v.toLowerCase().includes('gas')
        ) {
          return v.replace(/-/g, ' ');
        }
        return v;
      });
    if (values.length === 0) return;
    clauses.push(`${key} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }

  private addRangeClause(
    clauses: string[],
    params: unknown[],
    key: string,
    raw: unknown,
  ) {
    if (!raw || typeof raw !== 'object') return;
    const value = raw as Record<string, unknown>;
    const from = this.toStr(value.from ?? '');
    const to = this.toStr(value.to ?? '');
    if (from) {
      clauses.push(`${key} > ?`);
      params.push(from);
    }
    if (to) {
      clauses.push(`${key} < ?`);
      params.push(to);
    }
  }

  private addCustomsPaidClause(
    clauses: string[],
    params: unknown[],
    raw: unknown,
  ) {
    const value = this.toStr(raw ?? '');
    if (!value) return;
    if (value === '1' || value.toLowerCase() === 'true') {
      clauses.push('(customsPaid = 1 OR customsPaid IS NULL)');
      return;
    }
    if (value === '0' || value.toLowerCase() === 'false') {
      clauses.push('customsPaid = 0');
      return;
    }
    clauses.push('customsPaid = ?');
    params.push(value);
  }

  private termMap(searchTerms: FilterTerm[]) {
    const map = new Map<string, unknown>();
    for (const term of searchTerms) {
      if (!term || typeof term.key !== 'string') continue;
      map.set(term.key, term.value);
    }
    return map;
  }

  private toStr(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'bigint') return value.toString();
    return '';
  }

  private parseCsvValues(raw: string | undefined): string[] {
    return this.queryBuilder.parseCsvValues(raw);
  }

  private shouldApplySearchPersonalization(filter: SearchFilter): boolean {
    if (!this.personalizationService) return false;
    if (!this.personalizationService.isEnabled()) return false;
    if (
      this.personalizationService.isPersonalizationDisabled(
        filter.personalizationDisabled,
      )
    ) {
      return false;
    }
    if (!this.personalizationService.sanitizeVisitorId(filter.visitorId)) {
      return false;
    }
    if (!this.isDefaultRenewedTimeSort(filter)) {
      return false;
    }
    if (this.toStr(filter.keyword ?? '')) {
      return false;
    }
    if (this.toStr(filter.generalSearch ?? '')) {
      return false;
    }

    return !this.hasActiveSearchTerms(filter);
  }

  private shouldApplyMostWantedPersonalization(
    visitorId?: string,
    personalizationDisabled?: boolean | string | number,
  ): boolean {
    if (!this.personalizationService) return false;
    if (!this.personalizationService.isEnabled()) return false;
    if (this.personalizationService.isPersonalizationDisabled(personalizationDisabled)) {
      return false;
    }
    return Boolean(this.personalizationService.sanitizeVisitorId(visitorId));
  }

  private hasActiveSearchTerms(filter: SearchFilter): boolean {
    const terms = Array.isArray(filter.searchTerms) ? filter.searchTerms : [];
    for (const term of terms) {
      if (!term || typeof term.key !== 'string') continue;

      const value = term.value;
      if (value == null) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        const range = value as { from?: unknown; to?: unknown };
        if (this.toStr(range.from ?? '') || this.toStr(range.to ?? '')) {
          return true;
        }
        continue;
      }

      if (this.toStr(value)) {
        return true;
      }
    }
    return false;
  }

  private isDefaultRenewedTimeSort(filter: SearchFilter): boolean {
    const sort =
      Array.isArray(filter.sortTerms) && filter.sortTerms.length > 0
        ? filter.sortTerms[0]
        : {};

    const key = this.toStr(sort?.key ?? 'renewedTime') || 'renewedTime';
    const order = (this.toStr(sort?.order ?? 'DESC') || 'DESC').toUpperCase();

    return key === 'renewedTime' && order === 'DESC';
  }

  private buildPersonalizedSearchOrder(terms: PersonalizationTermScore[]): {
    orderSql: string | null;
    orderParams: unknown[];
  } {
    const relevant = this.pickRankableTerms(terms);
    if (relevant.length === 0) {
      return { orderSql: null, orderParams: [] };
    }

    const interestParts: string[] = [];
    const orderParams: unknown[] = [];
    for (const term of relevant) {
      const column = this.rankColumnForKey(term.termKey);
      if (!column) continue;
      interestParts.push(`CASE WHEN ${column} = ? THEN ? ELSE 0 END`);
      orderParams.push(term.termValue, term.score);
    }

    if (interestParts.length === 0) {
      return { orderSql: null, orderParams: [] };
    }

    const interestExpr = interestParts.join(' + ');
    return {
      orderSql: `ORDER BY ((0.7 * (${interestExpr})) + (0.3 * (COALESCE(renewedTime, 0) / 2147483647))) DESC, renewedTime DESC, id DESC`,
      orderParams,
    };
  }

  private buildPersonalizedMostWantedOrder(terms: PersonalizationTermScore[]): {
    orderSql: string | null;
    orderParams: unknown[];
  } {
    const relevant = this.pickRankableTerms(terms);
    if (relevant.length === 0) {
      return { orderSql: null, orderParams: [] };
    }

    const interestParts: string[] = [];
    const orderParams: unknown[] = [];
    for (const term of relevant) {
      const column = this.rankColumnForKey(term.termKey, 's');
      if (!column) continue;
      interestParts.push(`CASE WHEN ${column} = ? THEN ? ELSE 0 END`);
      orderParams.push(term.termValue, term.score);
    }

    if (interestParts.length === 0) {
      return { orderSql: null, orderParams: [] };
    }

    const interestExpr = interestParts.join(' + ');
    const baseExpr =
      '(COALESCE(s.mostWantedTo, 0) / 2147483647) + (COALESCE(p.clicks, 0) / 10000)';

    return {
      orderSql: `ORDER BY ((0.7 * (${interestExpr})) + (0.3 * (${baseExpr}))) DESC, s.mostWantedTo DESC, p.clicks DESC`,
      orderParams,
    };
  }

  private pickRankableTerms(
    terms: PersonalizationTermScore[],
  ): PersonalizationTermScore[] {
    if (!Array.isArray(terms)) return [];

    const allowed = new Set([
      'make',
      'model',
      'bodyType',
      'fuelType',
      'transmission',
      'type',
    ]);

    return terms
      .map((term) => ({
        termKey: this.toStr(term.termKey),
        termValue: this.toStr(term.termValue),
        score: Number(term.score ?? 0),
      }))
      .filter(
        (term) =>
          allowed.has(term.termKey) &&
          term.termValue.length > 0 &&
          Number.isFinite(term.score) &&
          term.score > 0,
      )
      .slice(0, 40);
  }

  private rankColumnForKey(termKey: string, alias?: string): string | null {
    const prefix = alias ? `${alias}.` : '';
    switch (termKey) {
      case 'make':
        return `${prefix}make`;
      case 'model':
        return `${prefix}model`;
      case 'bodyType':
        return `${prefix}bodyType`;
      case 'fuelType':
        return `${prefix}fuelType`;
      case 'transmission':
        return `${prefix}transmission`;
      case 'type':
        return `${prefix}type`;
      default:
        return null;
    }
  }

  private getMostWantedRecencyDays(): number {
    const configured = Number(process.env.MOST_WANTED_RECENCY_DAYS ?? '2');
    if (!Number.isFinite(configured)) return 2;
    return Math.max(0, Math.floor(configured));
  }

  private async timeQuery<T>(name: string, task: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const durationMs = Date.now() - startedAt;
      const budgetMs = this.queryBudgetsMs[name] ?? 250;
      this.logger.info('query.timing', { name, durationMs, budgetMs });
      if (durationMs > budgetMs) {
        this.logger.warn('query.slow', { name, durationMs, budgetMs });
      }
    }
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (key === 'caption' && typeof value === 'string') {
          return decodeCaption(value);
        }
        return value;
      }),
    ) as T;
  }

  private withCarDetail(rows: unknown[]): unknown[] {
    return rows.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const item = row as Record<string, unknown>;
      return {
        ...item,
        car_detail: {
          make: item.make,
          model: item.model,
          variant: item.variant,
          registration: item.registration,
          mileage: item.mileage,
          transmission: item.transmission,
          fuelType: item.fuelType,
          engineSize: item.engineSize,
          drivetrain: item.drivetrain,
          seats: item.seats,
          numberOfDoors: item.numberOfDoors,
          bodyType: item.bodyType,
          customsPaid: item.customsPaid,
          canExchange: item.canExchange,
          options: item.options,
          emissionGroup: item.emissionGroup,
          type: item.type,
          contact: item.contact,
          price: item.price,
        },
      };
    });
  }

  private annotateRowsWithPromotion(
    rows: unknown[],
    promoted: Record<string, unknown> | null,
  ): unknown[] {
    const now = Math.floor(Date.now() / 1000);
    const promotedId = promoted ? this.toStr(promoted.id) : '';

    return rows.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const item = row as Record<string, unknown>;
      return {
        ...item,
        promoted: promotedId.length > 0 && this.toStr(item.id) === promotedId,
        highlighted: this.toNullableNumber(item.highlightedTo) > now,
      };
    }) as Record<string, unknown>[];
  }

  private annotateRelatedRows(
    rows: unknown[],
    promoted: Record<string, unknown> | null,
  ): unknown[] {
    const now = Math.floor(Date.now() / 1000);
    const promotedId = promoted ? this.toStr(promoted.id) : '';
    const promotedRow = promoted
      ? {
          ...promoted,
          promoted: true,
          highlighted:
            this.toNullableNumber((promoted as Record<string, unknown>).highlightedTo) >
            now,
        }
      : null;
    const mappedRows = this.annotateRowsWithPromotion(rows, promoted) as Record<
      string,
      unknown
    >[];

    if (!promotedRow) {
      return mappedRows;
    }
    const deduped = mappedRows.filter((row) => this.toStr(row.id) !== promotedId);
    return [promotedRow, ...deduped].slice(0, 4);
  }

  private mergeRowsWithPromoted(
    rows: unknown[],
    promoted: Record<string, unknown> | null,
  ): unknown[] {
    if (!promoted) {
      return rows;
    }
    const promotedId = this.toStr(promoted.id);
    const deduped = rows.filter((row) => {
      if (!row || typeof row !== 'object') return true;
      return this.toStr((row as Record<string, unknown>).id) !== promotedId;
    });
    return [promoted, ...deduped];
  }

  private toNullableNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
