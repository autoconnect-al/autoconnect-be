import { Controller, Get, Query, Req } from '@nestjs/common';
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
  async search(@Query() query: SearchDto, @Req() req: Request) {
    // Optional: user ID from JWT if present
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req['user']?.id as string | undefined;

    // Optional: session ID from header for anonymous users
    const sessionId = req.headers['x-session-id'] as string | undefined;

    // Pass userId (logged in) or sessionId (anonymous) for promoted post rotation
    return this.searchService.search(query, userId || sessionId);
  }

  @Get('most-wanted')
  async getMostWanted(@Query() query: MostWantedDto) {
    return this.mostWantedService.getMostWanted(query);
  }
}
