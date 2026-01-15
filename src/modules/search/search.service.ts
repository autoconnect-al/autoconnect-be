import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchDto } from './dto/search.dto';
import { normalizeGeneralSearch } from '../../common/search/search-normalizer';
import { buildKeywordSQL } from '../../common/search/keyword-filter';
import { Search } from './types/Search';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: SearchDto,
  ): Promise<{ page: number; limit: number; total: number; items: Search[] }> {
    const {
      generalSearch,
      keyword,
      sortBy = 'renewedTime',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    console.log(sortBy);

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
       BASE QUERY
    -------------------------------- */
    const sql = `
      FROM search
      WHERE deleted = '0'
      ${fullTextSQL}
      ${keywordFilter.sql}
    `;

    const params = [
      ...(fullTextParam ? [fullTextParam] : []),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...keywordFilter.params,
    ];

    /* -----------------------------
       DATA QUERY
    -------------------------------- */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const items = (await this.prisma.$queryRawUnsafe(
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
    const count = Number(countResult?.[0]?.total ?? 0);

    return {
      page,
      limit,
      total: Number(count || 0),
      items,
    };
  }
}
