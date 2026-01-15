import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SearchPostDto } from '../dto/search-post.dto';
import { Search } from '../types/Search';

@Injectable()
export class SearchPostService {
  constructor(private readonly prisma: PrismaService) {}

  async getPostById(id: string): Promise<SearchPostDto> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const post = (await this.prisma.$queryRawUnsafe(
      `
      SELECT *
      FROM search
      WHERE id = ?
      LIMIT 1
      `,
      BigInt(id),
    )) as Search[];

    if (!post || !post[0]) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    return this.mapToDto(post[0]);
  }

  private mapToDto(post: Search): SearchPostDto {
    return {
      ...post,
      id: post.id.toString(),
      caption: post.caption
        ? Buffer.from(post.caption, 'base64').toString('utf-8')
        : undefined,
      vendorId: post.vendorId.toString(),
    };
  }
}
