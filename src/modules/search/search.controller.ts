import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { MostWantedService } from './most-wanted.service';
import { MostWantedDto } from './dto/most-wanted.dto';

@Controller({
  path: 'search',
  version: '1',
})
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly mostWantedService: MostWantedService,
  ) {}

  @Get()
  async search(@Query() query: SearchDto) {
    return this.searchService.search(query);
  }

  @Get('most-wanted')
  async getMostWanted(@Query() query: MostWantedDto) {
    return this.mostWantedService.getMostWanted(query);
  }
}
