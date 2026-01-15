import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MostWantedDto } from './dto/most-wanted.dto';
import { Search } from './types/Search';

@Injectable()
export class MostWantedService {
  constructor(private readonly prisma: PrismaService) {}

  async getMostWanted(query: MostWantedDto): Promise<Search[]> {
    const { type = 'car', limit = 4, excludeIds = [] } = query;

    const results: Search[] = [];
    const now = Math.floor(Date.now() / 1000);

    /* -----------------------------
       TIER 1 — EXPLICIT MOST WANTED
    -------------------------------- */
    const tier1 = await this.fetchExplicitMostWanted(
      type,
      now,
      limit,
      excludeIds,
    );

    results.push(...tier1);

    /* -----------------------------
       TIER 2 — FALLBACK POPULARITY
    -------------------------------- */
    if (results.length < limit) {
      const remaining = limit - results.length;
      const excludedIds: bigint[] = [
        ...excludeIds,
        ...results.map((r) => r.id),
      ];
      const tier2 = await this.fetchPopularityFallback(
        type,
        remaining,
        excludedIds,
      );

      results.push(...tier2);
    }

    return results;
  }

  /* =========================================================
     TIER 1 — PROMOTED / MANUAL MOST WANTED
  ========================================================= */
  private fetchExplicitMostWanted(
    type: string,
    now: number,
    limit: number,
    excludeIds: bigint[],
  ): Promise<Search[]> {
    const excludeSql =
      excludeIds.length > 0
        ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})`
        : '';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.prisma.$queryRawUnsafe(
      `
      SELECT *
      FROM search
      WHERE
        deleted = '0'
        AND type = ?
        AND mostWantedTo >= ?
        ${excludeSql}
      ORDER BY mostWantedTo DESC
      LIMIT ?
      `,
      type,
      now,
      ...excludeIds,
      limit,
    ) as Promise<Search[]>;
  }

  /* =========================================================
     TIER 2 — ORGANIC POPULARITY FALLBACK
  ========================================================= */
  private fetchPopularityFallback(
    type: string,
    limit: number,
    excludeIds: bigint[],
  ): Promise<Search[]> {
    const excludeSql =
      excludeIds.length > 0
        ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})`
        : '';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.prisma.$queryRawUnsafe(
      `
      SELECT *,
        (
          IFNULL(viewsCount, 0) * 1 +
          IFNULL(likesCount, 0) * 3 -
          (UNIX_TIMESTAMP() - IFNULL(renewedTime, UNIX_TIMESTAMP())) / 86400 * 0.5
        ) AS score
      FROM search
      WHERE
        deleted = '0'
        AND type = ?
        ${excludeSql}
      ORDER BY score DESC
      LIMIT ?
      `,
      type,
      ...excludeIds,
      limit,
    ) as Promise<Search[]>;
  }
}
