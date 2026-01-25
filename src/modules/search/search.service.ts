import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchDto } from './dto/search.dto';
import {
  buildAdditionalFilters,
  normalizeGeneralSearch,
} from '../../common/search/search-normalizer';
import { buildKeywordSQL } from '../../common/search/keyword-filter';
import { Search } from './types/Search';
import { mapSearchToListDto, SearchListDto } from './dto/search-list.dto';
import { SearchHelper } from './common/search-helper';

interface PromotedCacheItem {
  lastPromotedId: bigint | null;
  actionCount: number;
  lastRotatedAt?: number;
}

@Injectable()
export class SearchService {
  // userId/sessionId → rotation info
  private promotedCache = new Map<string, PromotedCacheItem>();

  // rotation window for anonymous users (in seconds)
  private readonly ANON_ROTATION_INTERVAL = 120; // e.g., rotate every 2 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchHelper: SearchHelper,
  ) {}

  async search(
    query: SearchDto,
    userIdOrSessionId?: string,
  ): Promise<{
    page: number;
    limit: number;
    total: number;
    items: SearchListDto[];
  }> {
    const {
      generalSearch,
      keyword,
      sortBy = 'renewedTime',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const offset = (page - 1) * limit;

    /* -----------------------------
       CORRECT MAKE / MODEL / VARIANT
    -------------------------------- */
    const makeModelPairs: Array<{
      makeKey: keyof SearchDto;
      modelKey: keyof SearchDto;
      variantKey: keyof SearchDto;
    }> = [
      { makeKey: 'make1', modelKey: 'model1', variantKey: 'variant1' },
      { makeKey: 'make2', modelKey: 'model2', variantKey: 'variant2' },
      { makeKey: 'make3', modelKey: 'model3', variantKey: 'variant3' },
    ];

    for (const pair of makeModelPairs) {
      const make = query[pair.makeKey];
      const model = query[pair.modelKey];

      if (make) {
        // Correct the make using the helper
        query[pair.makeKey as string] =
          (await this.searchHelper.getCorrectMake(make as string)) ?? make;
      }

      if (query[pair.makeKey] && model) {
        // Correct the model using the helper
        const preparedModel = await this.searchHelper.prepareMakeModel(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          query[pair.makeKey as string],
          model as string,
        );
        if (preparedModel) {
          query[pair.modelKey as string] = preparedModel.model;
        }
      }
    }

    /* -----------------------------
       FULLTEXT SEARCH
    -------------------------------- */
    const tokens = normalizeGeneralSearch(generalSearch || '');
    const fullTextSQL = tokens.length
      ? 'AND MATCH(cleanedCaption) AGAINST (? IN BOOLEAN MODE)'
      : '';
    const fullTextParam = tokens.length
      ? tokens.map((t) => `+${t}*`).join(' ')
      : null;

    /* -----------------------------
       KEYWORD SQL
    -------------------------------- */
    const keywordFilter = buildKeywordSQL(keyword);

    /* -----------------------------
       FETCH PROMOTED POST
    -------------------------------- */
    let promoted: Search | null;
    const excludePromotedIds: bigint[] = [];

    if (userIdOrSessionId) {
      const cache = this.promotedCache.get(userIdOrSessionId) || {
        lastPromotedId: null,
        actionCount: 0,
        lastRotatedAt: undefined,
      };

      cache.actionCount++;
      const now = Math.floor(Date.now() / 1000);
      const rotate =
        cache.lastRotatedAt === undefined ||
        cache.actionCount % 2 === 0 ||
        (cache.lastRotatedAt &&
          now - cache.lastRotatedAt > this.ANON_ROTATION_INTERVAL);

      promoted = await this.fetchPromotedPost(
        keyword,
        fullTextSQL,
        fullTextParam,
        rotate ? cache.lastPromotedId : null,
      );

      if (promoted) {
        excludePromotedIds.push(promoted.id);
        this.promotedCache.set(userIdOrSessionId, {
          lastPromotedId: rotate ? promoted.id : cache.lastPromotedId,
          actionCount: cache.actionCount,
          lastRotatedAt: rotate ? now : cache.lastRotatedAt,
        });
      } else {
        this.promotedCache.set(userIdOrSessionId, cache);
      }
    } else {
      // anonymous fallback
      promoted = await this.fetchPromotedPost(
        keyword,
        fullTextSQL,
        fullTextParam,
        null,
      );
      if (promoted) excludePromotedIds.push(promoted.id);
    }

    const additionalFilters = buildAdditionalFilters(query);

    /* -----------------------------
       BASE QUERY
    -------------------------------- */
    const sql = `
    FROM search
    WHERE deleted = '0'
    ${fullTextSQL}
    ${keywordFilter.sql}
    ${additionalFilters.sql}
    ${
      excludePromotedIds.length
        ? `AND id NOT IN (${excludePromotedIds.map(() => '?').join(',')})`
        : ''
    }
  `;

    const params = [
      ...(fullTextParam ? [fullTextParam] : []),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...keywordFilter.params,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...additionalFilters.params,
      ...excludePromotedIds,
    ];

    /* -----------------------------
       DATA QUERY
    -------------------------------- */

    const items: Search[] = await this.prisma.$queryRawUnsafe(
      `
    SELECT *
    ${sql}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
    `,
      ...params,
      limit,
      offset,
    );

    /* -----------------------------
       COUNT QUERY
    -------------------------------- */

    const countResult: any = await this.prisma.$queryRawUnsafe(
      `
    SELECT COUNT(*) as total
    ${sql}
    `,
      ...params,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const total = Number(countResult?.[0]?.total ?? 0);

    /* -----------------------------
       MAP TO DTO
    -------------------------------- */
    const mappedResults: SearchListDto[] = [
      ...(promoted ? [mapSearchToListDto(promoted)] : []),
      ...items.map(mapSearchToListDto),
    ];

    return {
      page,
      limit,
      total,
      items: mappedResults,
    };
  }

  /* -----------------------------
     FETCH PROMOTED POST HELPER
  -------------------------------- */
  private async fetchPromotedPost(
    keyword: string | undefined,
    fullTextSQL: string,
    fullTextParam: string | null,
    excludeId: bigint | null,
  ): Promise<Search | null> {
    const excludeSql = excludeId ? `AND id != ?` : '';
    const keywordSql = keyword ? buildKeywordSQL(keyword).sql : '';

    const sql = `
        SELECT *
        FROM search
        WHERE deleted = '0'
          AND promotionTo >= UNIX_TIMESTAMP()
            ${fullTextSQL}
            ${keywordSql}
            ${excludeSql}
        ORDER BY RAND()
            LIMIT 1
    `;

    const params = [
      ...(fullTextParam ? [fullTextParam] : []),
      ...(excludeId ? [excludeId] : []),
    ];

    const result: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result[0] || null;
  }
}
