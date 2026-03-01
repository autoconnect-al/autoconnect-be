import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { decodeCaption } from '../imports/utils/caption-processor';
import { createLogger } from '../../common/logger.util';
import {
  LegacySearchQueryBuilder,
  type FilterTerm,
  type ResolvedSearchModel,
  type SearchFilter,
} from './legacy-search-query-builder';
import {
  PersonalizationService,
  type PersonalizationTermScore,
} from '../personalization/personalization.service';
import { enrichRowsWithPostStats } from '../../common/post-stats-enrichment.util';

type RankablePersonalizationTerm = {
  termKey: string;
  termValue: string;
  normalizedValue: string;
  score: number;
  searchCount: number;
  openCount: number;
  contactCount: number;
  impressionCount: number;
  dateUpdatedMs: number | null;
  lastEventAtMs: number | null;
};

type ActiveRankTerm = RankablePersonalizationTerm & {
  affinity: number;
};

type PersonalizedCandidate = {
  id: string;
  row: Record<string, unknown>;
  make: string;
  model: string;
  renewedTime: number;
  baselineRank: number;
  freshnessScore: number;
  interestScore: number;
  finalScore: number;
};

const PERSONALIZATION_KEY_WEIGHTS: Record<string, number> = {
  model: 0.35,
  make: 0.2,
  bodyType: 0.2,
  fuelType: 0.1,
  transmission: 0.1,
  type: 0.05,
};

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
    const resolvedModel = await this.resolveSearchModelTerm(filter);
    const { whereSql, params } = this.queryBuilder.buildWhere(
      filter,
      resolvedModel,
    );
    const { limit, offset } = this.queryBuilder.buildSortAndPagination(filter);
    const orderSql = this.queryBuilder.buildSortAndPagination(filter).orderSql;
    const queryLimit = shouldApplyPersonalization
      ? this.buildPersonalizedSearchCandidateLimit(limit, offset)
      : limit;
    const queryOffset = shouldApplyPersonalization ? 0 : offset;

    const rawRows = await this.timeQuery('search', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM search ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
        ...params,
        queryLimit,
        queryOffset,
      ),
    );
    const rows = shouldApplyPersonalization
      ? this.composePersonalizedRows(
          rawRows,
          personalizationTerms,
          limit,
          offset,
          'search',
        )
      : rawRows;

    const recordSignalPromise =
      this.personalizationService?.recordSearchSignal(filter);
    void recordSignalPromise?.catch((error) =>
        this.logger.warn('personalization.search-signal.failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );

    const merged = this.mergeRowsWithPromoted(rows, promoted);
    const enrichedRows = await enrichRowsWithPostStats(this.prisma, merged);
    return legacySuccess(
      this.normalizeBigInts(
        this.annotateRowsWithPromotion(enrichedRows, promoted),
      ),
    );
  }

  async countResults(filterRaw: string | undefined) {
    const filter = this.queryBuilder.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while counting results', 500);
    }
    const resolvedModel = await this.resolveSearchModelTerm(filter);
    const { whereSql, params } = this.queryBuilder.buildWhere(
      filter,
      resolvedModel,
    );
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
    const orderSql = 'ORDER BY s.mostWantedTo DESC, p.clicks DESC';
    const limit = shouldApplyPersonalization
      ? this.getMostWantedPersonalizationCandidates()
      : 4;

    const query = `SELECT s.id, s.make, s.model, s.variant, s.registration, s.mileage, s.price, s.transmission, s.fuelType, s.engineSize, s.drivetrain, s.seats, s.numberOfDoors, s.bodyType, s.customsPaid, s.canExchange, s.options, s.emissionGroup, s.type, s.accountName, s.sidecarMedias, s.contact, s.vendorContact, s.profilePicture, s.vendorId, s.promotionTo, s.highlightedTo, s.renewTo, s.renewInterval, s.renewedTime, s.mostWantedTo
      FROM search s
      INNER JOIN post p ON p.id = s.id
      WHERE ${clauses.join(' AND ')}
      ${orderSql}
      LIMIT ${limit}`;
    const rawRows = await this.timeQuery('most_wanted', () =>
      this.prisma.$queryRawUnsafe<unknown[]>(
        query,
        ...params,
      ),
    );
    const rows = shouldApplyPersonalization
      ? this.composePersonalizedRows(
          rawRows,
          personalizationTerms,
          4,
          0,
          'most_wanted',
        )
      : rawRows;
    const enrichedRows = await enrichRowsWithPostStats(
      this.prisma,
      this.withCarDetail(rows),
    );
    return legacySuccess(this.normalizeBigInts(enrichedRows));
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
    const enrichedRows = await enrichRowsWithPostStats(this.prisma, rows);
    return legacySuccess(this.normalizeBigInts(enrichedRows));
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
    const annotatedRows = this.annotateRelatedRows(this.withCarDetail(rows), promoted);
    const enrichedRows = await enrichRowsWithPostStats(this.prisma, annotatedRows);
    return legacySuccess(this.normalizeBigInts(enrichedRows));
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
    const annotatedRows = this.annotateRelatedRows(this.withCarDetail(rows), promoted);
    const enrichedRows = await enrichRowsWithPostStats(this.prisma, annotatedRows);
    return legacySuccess(this.normalizeBigInts(enrichedRows));
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

    const normalizedInput = this.normalizeModelToken(
      this.stripAllModelSuffix(model),
    );
    let foundModel: { model: string; isVariant: boolean } | null = null;
    let foundModelScore = -1;

    for (const row of rows) {
      const dbModel = this.toStr(row.Model ?? '');
      if (!dbModel) continue;
      const normalizedDb = this.normalizeModelToken(
        this.stripAllModelSuffix(dbModel),
      );
      if (normalizedDb === normalizedInput) {
        return {
          model: dbModel,
          variant: dbModel,
          isVariant: Boolean(row.isVariant),
        };
      }

      const startsWithModel = normalizedDb.startsWith(normalizedInput);
      const startsWithModelReverse = normalizedInput.startsWith(normalizedDb);
      if (!startsWithModel && !startsWithModelReverse) {
        continue;
      }

      const score = this.modelSimilarityScore(normalizedDb, normalizedInput);
      if (score <= foundModelScore) {
        continue;
      }

      foundModel = {
        model: dbModel,
        isVariant: Boolean(row.isVariant),
      };
      foundModelScore = score;
    }

    if (foundModel) {
      return {
        model: foundModel.model,
        variant: foundModel.model,
        isVariant: foundModel.isVariant,
      };
    }

    const fallback = model.replace(/-/g, ' ');
    return { model: fallback, variant: fallback, isVariant: false };
  }

  private normalizeModelToken(value: string): string {
    return value.replace(/\s+/g, '-').toLowerCase();
  }

  private stripAllModelSuffix(value: string): string {
    return value.replace(' (all)', '').trim();
  }

  private modelSimilarityScore(first: string, second: string): number {
    if (!first || !second) {
      return 0;
    }

    const rows = first.length + 1;
    const cols = second.length + 1;
    const matrix = Array.from({ length: rows }, () =>
      Array<number>(cols).fill(0),
    );

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        if (first[i - 1] === second[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    return matrix[rows - 1][cols - 1];
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

  private buildWhere(filter: SearchFilter, resolvedModel?: ResolvedSearchModel | null) {
    return this.queryBuilder.buildWhere(filter, resolvedModel);
  }

  private async resolveSearchModelTerm(
    filter: SearchFilter,
  ): Promise<ResolvedSearchModel | null> {
    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '');
    if (!make || !model) {
      return null;
    }

    const resolved = await this.resolveModel(make, model);
    return {
      model: resolved.model,
      isVariant: resolved.isVariant,
    };
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
    const ignoredKeys = new Set(['type']);
    for (const term of terms) {
      if (!term || typeof term.key !== 'string') continue;
      const normalizedKey = this.toStr(term.key).toLowerCase();
      if (!normalizedKey || ignoredKeys.has(normalizedKey)) {
        continue;
      }

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

  private composePersonalizedRows(
    rows: unknown[],
    terms: PersonalizationTermScore[],
    limit: number,
    offset: number,
    context: 'search' | 'most_wanted',
  ): unknown[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 24;
    const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const activeTerms = this.buildActiveRankTerms(terms);
    const activeTermsByKey = this.buildActiveTermsByKey(activeTerms);
    if (activeTerms.length === 0) {
      this.logger.info(`personalization.${context}.compose`, {
        candidateSize: rows.length,
        activeTermsByKey,
        reason: 'no_active_terms',
      });
      return rows.slice(safeOffset, safeOffset + safeLimit);
    }

    const candidates = this.buildPersonalizationCandidates(rows, activeTerms);
    if (candidates.length === 0) {
      this.logger.info(`personalization.${context}.compose`, {
        candidateSize: rows.length,
        activeTermsByKey,
        reason: 'no_candidate_rows',
      });
      return rows.slice(safeOffset, safeOffset + safeLimit);
    }

    const pageSize = Math.max(1, safeLimit);
    const personalizedSlots = Math.max(
      0,
      Math.min(
        pageSize,
        Math.floor(pageSize * this.getPersonalizationMaxPersonalizedShare()),
      ),
    );
    const modelCap = Math.max(
      1,
      Math.ceil(pageSize * this.getPersonalizationModelMaxShare()),
    );
    const makeCap = Math.max(
      1,
      Math.ceil(pageSize * this.getPersonalizationMakeMaxShare()),
    );

    const personalizedPool = [...candidates]
      .filter((candidate) => candidate.interestScore > 0)
      .sort(
        (a, b) =>
          b.finalScore - a.finalScore
          || b.freshnessScore - a.freshnessScore
          || b.renewedTime - a.renewedTime
          || b.id.localeCompare(a.id),
      );
    const freshPool = [...candidates].sort(
      (a, b) =>
        a.baselineRank - b.baselineRank
        || b.renewedTime - a.renewedTime
        || b.id.localeCompare(a.id),
    );

    const selectedIds = new Set<string>();
    const ordered: PersonalizedCandidate[] = [];
    const firstPageCapHits = { model: 0, make: 0 };
    let firstPagePersonalizedCount = 0;

    while (ordered.length < candidates.length) {
      const pageRows: PersonalizedCandidate[] = [];
      const modelCounts = new Map<string, number>();
      const makeCounts = new Map<string, number>();
      const capHits = { model: 0, make: 0 };

      const personalizedCount = this.addFromCandidatePool(
        personalizedPool,
        pageRows,
        selectedIds,
        personalizedSlots,
        modelCounts,
        makeCounts,
        modelCap,
        makeCap,
        capHits,
      );

      this.addFromCandidatePool(
        freshPool,
        pageRows,
        selectedIds,
        pageSize - pageRows.length,
        modelCounts,
        makeCounts,
        modelCap,
        makeCap,
        capHits,
      );

      if (pageRows.length < pageSize) {
        this.addFromCandidatePool(
          personalizedPool,
          pageRows,
          selectedIds,
          pageSize - pageRows.length,
          modelCounts,
          makeCounts,
          modelCap,
          makeCap,
          capHits,
        );
      }

      if (ordered.length === 0) {
        firstPageCapHits.model = capHits.model;
        firstPageCapHits.make = capHits.make;
        firstPagePersonalizedCount = personalizedCount;
        if (personalizedCount < personalizedSlots) {
          this.logger.warn(`personalization.${context}.below-target`, {
            candidateSize: candidates.length,
            personalizedSlots,
            personalizedCount,
            capHits,
            activeTermsByKey,
          });
        }
      }

      if (pageRows.length === 0) {
        this.logger.warn(`personalization.${context}.compose-empty-page`, {
          candidateSize: candidates.length,
          selectedCount: ordered.length,
          pageSize,
          activeTermsByKey,
        });
        break;
      }

      ordered.push(...pageRows);
    }

    this.logger.info(`personalization.${context}.compose`, {
      candidateSize: candidates.length,
      activeTermsByKey,
      pageSize,
      personalizedSlots,
      modelCap,
      makeCap,
      firstPagePersonalizedCount,
      firstPageCapHits,
    });

    return ordered
      .slice(safeOffset, safeOffset + safeLimit)
      .map((candidate) => candidate.row);
  }

  private addFromCandidatePool(
    pool: PersonalizedCandidate[],
    destination: PersonalizedCandidate[],
    selectedIds: Set<string>,
    maxToAdd: number,
    modelCounts: Map<string, number>,
    makeCounts: Map<string, number>,
    modelCap: number,
    makeCap: number,
    capHits: { model: number; make: number },
  ): number {
    if (maxToAdd <= 0) {
      return 0;
    }

    let added = 0;
    for (const candidate of pool) {
      if (added >= maxToAdd) {
        break;
      }
      if (selectedIds.has(candidate.id)) {
        continue;
      }
      if (
        !this.canSelectCandidateWithCaps(
          candidate,
          modelCounts,
          makeCounts,
          modelCap,
          makeCap,
          capHits,
        )
      ) {
        continue;
      }

      destination.push(candidate);
      selectedIds.add(candidate.id);
      added += 1;

      if (candidate.model) {
        modelCounts.set(candidate.model, (modelCounts.get(candidate.model) ?? 0) + 1);
      }
      if (candidate.make) {
        makeCounts.set(candidate.make, (makeCounts.get(candidate.make) ?? 0) + 1);
      }
    }

    return added;
  }

  private canSelectCandidateWithCaps(
    candidate: PersonalizedCandidate,
    modelCounts: Map<string, number>,
    makeCounts: Map<string, number>,
    modelCap: number,
    makeCap: number,
    capHits: { model: number; make: number },
  ): boolean {
    if (candidate.model && (modelCounts.get(candidate.model) ?? 0) >= modelCap) {
      capHits.model += 1;
      return false;
    }
    if (candidate.make && (makeCounts.get(candidate.make) ?? 0) >= makeCap) {
      capHits.make += 1;
      return false;
    }
    return true;
  }

  private buildPersonalizationCandidates(
    rows: unknown[],
    activeTerms: ActiveRankTerm[],
  ): PersonalizedCandidate[] {
    const objects = rows
      .map((row, baselineRank) => {
        if (!row || typeof row !== 'object') {
          return null;
        }
        return {
          row: row as Record<string, unknown>,
          baselineRank,
        };
      })
      .filter(
        (
          item,
        ): item is {
          row: Record<string, unknown>;
          baselineRank: number;
        } => Boolean(item),
      );

    if (objects.length === 0) {
      return [];
    }

    const renewedTimes = objects.map((item) =>
      this.toNullableNumber(item.row.renewedTime),
    );
    const minRenewedTime = Math.min(...renewedTimes);
    const maxRenewedTime = Math.max(...renewedTimes);

    return objects.map((item) => {
      const id = this.toStr(item.row.id) || `candidate-${item.baselineRank}`;
      const make = this.normalizeComparableValue(item.row.make);
      const model = this.normalizeComparableValue(item.row.model);
      const renewedTime = this.toNullableNumber(item.row.renewedTime);
      const freshnessScore =
        maxRenewedTime > minRenewedTime
          ? (renewedTime - minRenewedTime) / (maxRenewedTime - minRenewedTime)
          : 0;
      const interestScore = this.scoreRowInterest(item.row, activeTerms);
      const finalScore = 0.6 * interestScore + 0.4 * freshnessScore;

      return {
        id,
        row: item.row,
        make,
        model,
        renewedTime,
        baselineRank: item.baselineRank,
        freshnessScore,
        interestScore,
        finalScore,
      };
    });
  }

  private scoreRowInterest(
    row: Record<string, unknown>,
    activeTerms: ActiveRankTerm[],
  ): number {
    let score = 0;

    for (const [termKey, weight] of Object.entries(PERSONALIZATION_KEY_WEIGHTS)) {
      const rowValue = this.normalizeComparableValue(this.valueForTermKey(row, termKey));
      if (!rowValue) {
        continue;
      }

      let bestAffinity = 0;
      for (const term of activeTerms) {
        if (term.termKey !== termKey) continue;
        if (term.normalizedValue !== rowValue) continue;
        if (term.affinity > bestAffinity) {
          bestAffinity = term.affinity;
        }
      }
      if (bestAffinity > 0) {
        score += weight * bestAffinity;
      }
    }

    return score;
  }

  private valueForTermKey(row: Record<string, unknown>, termKey: string): unknown {
    switch (termKey) {
      case 'make':
        return row.make;
      case 'model':
        return row.model;
      case 'bodyType':
        return row.bodyType;
      case 'fuelType':
        return row.fuelType;
      case 'transmission':
        return row.transmission;
      case 'type':
        return row.type;
      default:
        return '';
    }
  }

  private buildActiveRankTerms(terms: PersonalizationTermScore[]): ActiveRankTerm[] {
    const rankableTerms = this.pickRankableTerms(terms);
    if (rankableTerms.length === 0) {
      return [];
    }

    const maxScoreByKey = new Map<string, number>();
    for (const term of rankableTerms) {
      const current = maxScoreByKey.get(term.termKey) ?? 0;
      if (term.score > current) {
        maxScoreByKey.set(term.termKey, term.score);
      }
    }

    return rankableTerms
      .filter((term) => this.isTermActive(term))
      .map((term) => {
        const maxScoreWithinKey = maxScoreByKey.get(term.termKey) ?? 0;
        const keyNormalizedScore =
          maxScoreWithinKey > 0 ? term.score / maxScoreWithinKey : 0;
        const eventStrength =
          (1.0 * term.searchCount)
          + (2.0 * term.openCount)
          + (5.0 * term.contactCount)
          + (0.25 * term.impressionCount);
        const eventConfidence = Math.min(
          1,
          Math.log1p(eventStrength) / Math.log1p(12),
        );
        const eventTimeMs = term.lastEventAtMs ?? term.dateUpdatedMs;
        const ageDays = eventTimeMs
          ? Math.max(0, (Date.now() - eventTimeMs) / (24 * 60 * 60 * 1000))
          : 0;
        const recencyDecay = Math.exp(-ageDays / 21);
        const affinity = keyNormalizedScore * eventConfidence * recencyDecay;

        return {
          ...term,
          affinity,
        };
      })
      .filter((term) => Number.isFinite(term.affinity) && term.affinity > 0)
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 80);
  }

  private pickRankableTerms(
    terms: PersonalizationTermScore[],
  ): RankablePersonalizationTerm[] {
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
        normalizedValue: this.normalizeComparableValue(term.termValue),
        score: Number(term.score ?? 0),
        searchCount: this.toNonNegativeInt(term.searchCount),
        openCount: this.toNonNegativeInt(term.openCount),
        contactCount: this.toNonNegativeInt(term.contactCount),
        impressionCount: this.toNonNegativeInt(term.impressionCount),
        dateUpdatedMs: this.toTimestampMs(term.dateUpdated),
        lastEventAtMs: this.toTimestampMs(term.lastEventAt),
      }))
      .filter(
        (term) =>
          allowed.has(term.termKey)
          && term.termValue.length > 0
          && Number.isFinite(term.score)
          && term.score > 0,
      )
      .slice(0, 100);
  }

  private isTermActive(term: RankablePersonalizationTerm): boolean {
    if (term.contactCount >= this.getPersonalizationContactThreshold()) {
      return true;
    }
    return term.openCount >= this.getOpenThresholdForTermKey(term.termKey);
  }

  private getOpenThresholdForTermKey(termKey: string): number {
    switch (termKey) {
      case 'model':
        return this.getPersonalizationModelOpenThreshold();
      case 'make':
        return this.getPersonalizationMakeOpenThreshold();
      case 'bodyType':
        return this.getPersonalizationBodyTypeOpenThreshold();
      default:
        return this.getPersonalizationGenericOpenThreshold();
    }
  }

  private buildActiveTermsByKey(terms: ActiveRankTerm[]): Record<string, number> {
    const byKey: Record<string, number> = {};
    for (const term of terms) {
      byKey[term.termKey] = (byKey[term.termKey] ?? 0) + 1;
    }
    return byKey;
  }

  private buildPersonalizedSearchCandidateLimit(limit: number, offset: number): number {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 24;
    const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
    const requestedRows = safeOffset + safeLimit;
    const expanded =
      requestedRows * this.getPersonalizationSearchCandidateMultiplier();
    return Math.max(
      safeLimit,
      Math.min(this.getPersonalizationSearchCandidateMax(), expanded),
    );
  }

  private getMostWantedPersonalizationCandidates(): number {
    return Math.max(
      4,
      this.readPositiveIntEnv('PERSONALIZATION_MOST_WANTED_CANDIDATES', 24),
    );
  }

  private getPersonalizationMaxPersonalizedShare(): number {
    return this.readRatioEnv('PERSONALIZATION_MAX_PERSONALIZED_SHARE', 0.6);
  }

  private getPersonalizationModelMaxShare(): number {
    return this.readRatioEnv('PERSONALIZATION_MODEL_MAX_SHARE', 0.25);
  }

  private getPersonalizationMakeMaxShare(): number {
    return this.readRatioEnv('PERSONALIZATION_MAKE_MAX_SHARE', 0.4);
  }

  private getPersonalizationSearchCandidateMultiplier(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_SEARCH_CANDIDATE_MULTIPLIER', 5);
  }

  private getPersonalizationSearchCandidateMax(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_SEARCH_CANDIDATE_MAX', 500);
  }

  private getPersonalizationModelOpenThreshold(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_MODEL_OPEN_THRESHOLD', 3);
  }

  private getPersonalizationMakeOpenThreshold(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_MAKE_OPEN_THRESHOLD', 2);
  }

  private getPersonalizationBodyTypeOpenThreshold(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_BODYTYPE_OPEN_THRESHOLD', 2);
  }

  private getPersonalizationGenericOpenThreshold(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_GENERIC_OPEN_THRESHOLD', 3);
  }

  private getPersonalizationContactThreshold(): number {
    return this.readPositiveIntEnv('PERSONALIZATION_CONTACT_THRESHOLD', 1);
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(1, Math.floor(parsed));
  }

  private readRatioEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(0, Math.min(1, parsed));
  }

  private normalizeComparableValue(value: unknown): string {
    return this.toStr(value).toLowerCase();
  }

  private toNonNegativeInt(value: unknown): number {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.trunc(numericValue));
  }

  private toTimestampMs(value: unknown): number | null {
    if (value instanceof Date) {
      const timestamp = value.getTime();
      return Number.isNaN(timestamp) ? null : timestamp;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
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
