import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchDto } from './dto/search.dto';
import { normalizeGeneralSearch } from '../../common/search/search-normalizer';
import { buildKeywordSQL } from '../../common/search/keyword-filter';
import { Search } from './types/Search';
import { mapSearchToListDto, SearchListDto } from './dto/search-list.dto';

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

  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: SearchDto,
    userIdOrSessionId?: string, // can be userId or anonymous sessionId
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
    let promoted: Search | null = null;
    const excludePromotedIds: bigint[] = [];

    if (userIdOrSessionId) {
      const cache = this.promotedCache.get(userIdOrSessionId) || {
        lastPromotedId: null,
        actionCount: 0,
        lastRotatedAt: undefined,
      };

      cache.actionCount++;

      // rotate conditions:
      // 1) logged-in user: every 2 actions
      // 2) anonymous user: every ANON_ROTATION_INTERVAL seconds
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
        if (rotate) {
          this.promotedCache.set(userIdOrSessionId, {
            lastPromotedId: promoted.id,
            actionCount: cache.actionCount,
            lastRotatedAt: now,
          });
        } else {
          this.promotedCache.set(userIdOrSessionId, cache);
        }
      }
    } else {
      // fallback: anonymous user without sessionId → completely random promoted
      promoted = await this.fetchPromotedPost(
        keyword,
        fullTextSQL,
        fullTextParam,
        null,
      );
      if (promoted) excludePromotedIds.push(promoted.id);
    }

    /* -----------------------------
       BASE QUERY
    -------------------------------- */
    const sql = `
      FROM search
      WHERE deleted = '0'
      ${fullTextSQL}
      ${keywordFilter.sql}
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
      ...excludePromotedIds,
    ];

    /* -----------------------------
       DATA QUERY
    -------------------------------- */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const items: Search[] = (await this.prisma.$queryRawUnsafe(
      `
      SELECT *
      ${sql}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
      `,
      ...params,
      limit,
      offset,
    )) as Search[];

    /* -----------------------------
       COUNT QUERY
    -------------------------------- */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const result = (await this.prisma.$queryRawUnsafe(
      sql,
      ...params,
    )) as Search[];
    return result[0] || null;
  }
}
