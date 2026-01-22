import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SearchPostDto } from '../dto/search-post.dto';
import { Search } from '../types/Search';

@Injectable()
export class SearchPostService {
  constructor(private readonly prisma: PrismaService) {}

  async getPostById(id: string): Promise<SearchPostDto> {
    const post = await this.prisma.$queryRawUnsafe(
      `
      SELECT *
      FROM search
      WHERE id = ?
      LIMIT 1
      `,
      BigInt(id),
    );

    if (!post || !post[0]) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
