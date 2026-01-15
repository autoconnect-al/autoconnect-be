import { Controller, Get, Param, Query } from '@nestjs/common';
import { RelatedPostsService } from './related-posts.service';
import { SearchListDto, mapSearchToListDto } from './dto/search-list.dto';
import { Search } from './types/Search';
import { SearchDto } from './dto/search.dto';

@Controller({
  path: 'related-posts',
  version: '1',
})
export class RelatedPostsController {
  constructor(private readonly relatedPostsService: RelatedPostsService) {}

  @Get('by-post/:id')
  async getByPostId(
    @Param('id') postId: string,
    @Query('excludeIds') excludeIds?: string,
  ): Promise<SearchListDto[]> {
    const exclude = excludeIds
      ? excludeIds.split(',').map((id) => BigInt(id))
      : [];
    const posts: Search[] = await this.relatedPostsService.getRelatedByPostId(
      postId,
      {
        limit: 4,
        excludeIds: exclude,
      },
    );
    return posts.map(mapSearchToListDto);
  }

  @Get('by-filter')
  async getByFilter(
    @Query() query: Partial<SearchDto> & { excludeIds?: string },
  ): Promise<SearchListDto[]> {
    const { excludeIds, ...filters } = query;
    const exclude = excludeIds
      ? excludeIds.split(',').map((id) => BigInt(id))
      : [];
    const posts: Search[] = await this.relatedPostsService.getRelatedByFilter(
      filters,
      {
        limit: 4,
        excludeIds: exclude,
      },
    );
    return posts.map(mapSearchToListDto);
  }

  @Get('caption/:id')
  async getCaption(@Param('id') postId: string) {
    return this.relatedPostsService.getPostCaption(postId);
  }
}
