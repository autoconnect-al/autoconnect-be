import { Controller, Get, Param } from '@nestjs/common';
import { SearchPostService } from './search-post.service';
import { SearchPostDto } from './dto/search-post.dto';

@Controller({
  path: 'post',
  version: '1',
})
export class SearchPostController {
  constructor(private readonly searchPostService: SearchPostService) {}

  @Get(':id')
  async getPost(@Param('id') id: string): Promise<SearchPostDto> {
    return this.searchPostService.getPostById(id);
  }
}
