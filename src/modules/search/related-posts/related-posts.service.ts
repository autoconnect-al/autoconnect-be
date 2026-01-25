import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Search } from '../types/Search';
import { SearchDto } from '../dto/search.dto';

interface RelatedPostsOptions {
  limit: number;
  excludeIds?: bigint[];
}

@Injectable()
export class RelatedPostsService {
  constructor(private readonly prisma: PrismaService) {}

  /* -----------------------------
     1. Related by Post ID
  -------------------------------- */
  async getRelatedByPostId(
    postId: string,
    options: RelatedPostsOptions = { limit: 4, excludeIds: [] },
  ): Promise<Search[]> {
    const postIdBig = BigInt(postId);

    const postResult = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM search WHERE id = ? AND deleted = '0'`,
      postIdBig,
    );

    if (!postResult.length) {
      throw new NotFoundException('Post not found');
    }

    const post = postResult[0];
    return this.fetchRelatedPosts(post, options);
  }

  /* -----------------------------
     2. Related by Filter
  -------------------------------- */
  async getRelatedByFilter(
    filters: Partial<SearchDto>,
    options: RelatedPostsOptions = { limit: 4, excludeIds: [] },
  ): Promise<Search[]> {
    return this.fetchRelatedPosts(filters, options);
  }

  /* -----------------------------
     3. Post Caption
  -------------------------------- */
  async getPostCaption(
    postId: string,
  ): Promise<{ cleanedCaption: string; mediaUrl: string }> {
    const postIdBig = BigInt(postId);

    const result = await this.prisma.$queryRawUnsafe(
      `SELECT cleanedCaption, sidecarMedias FROM search WHERE id = ? AND deleted = '0'`,
      postIdBig,
    );

    if (!result.length) throw new NotFoundException('No post found');

    let { cleanedCaption } = result[0];
    const { sidecarMedias } = result[0];

    // Clean caption (translated from PHP)
    cleanedCaption = cleanedCaption
      .replace(/ ,/g, ',')
      .replace(/ !/g, '!')
      .replace(/ - /g, '-')
      .replace(/ : /g, ':')
      .replace(/: /g, ':')
      .replace(/ :/g, ':')
      .replace(/\s+/g, ' ')
      .trim();

    const medias = JSON.parse(sidecarMedias || '[]') as {
      imageThumbnailUrl: string;
    }[];
    const mediaUrl = medias?.[0]?.imageThumbnailUrl || '';

    return { cleanedCaption, mediaUrl };
  }

  /* -----------------------------
     HELPER: Fetch Related Posts
  -------------------------------- */
  private async fetchRelatedPosts(
    criteria: Partial<SearchDto>,
    options: RelatedPostsOptions,
  ): Promise<Search[]> {
    const { limit, excludeIds = [] } = options;

    const filtersToTry: string[] = [
      'make',
      'model',
      'variant',
      'type',
      'registration',
      'price',
    ];

    const finalPosts: Search[] = [];
    const remainingExcludeIds = [...excludeIds];

    for (let i = 0; i <= filtersToTry.length; i++) {
      const sqlFilters = filtersToTry
        .slice(0, filtersToTry.length - i)
        .map((f) => (criteria[f] ? `${f} = ?` : null))
        .filter(Boolean)
        .join(' AND ');

      const excludeSql = remainingExcludeIds.length
        ? `AND id NOT IN (${remainingExcludeIds.map(() => '?').join(',')})`
        : '';

      const sql = `
        SELECT *
        FROM search
        WHERE deleted = '0'
        ${sqlFilters ? 'AND ' + sqlFilters : ''}
        ${excludeSql}
        ORDER BY RAND()
        LIMIT ?
      `;

      const params: any[] = [];
      filtersToTry.slice(0, filtersToTry.length - i).forEach((f) => {
        if (criteria[f]) params.push(criteria[f]);
      });
      params.push(...remainingExcludeIds);
      params.push(limit - finalPosts.length);

      const result = await this.prisma.$queryRawUnsafe(sql, ...params);
      const resultArray = result || [];
      finalPosts.push(...resultArray);
      remainingExcludeIds.push(...resultArray.map((r) => r.id));

      if (finalPosts.length >= limit) break;
    }

    return finalPosts.slice(0, limit);
  }
}
