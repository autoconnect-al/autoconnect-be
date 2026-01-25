import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { MostWantedService } from './most-wanted/most-wanted.service';
import { MostWantedDto } from './dto/most-wanted.dto';

@Controller({
  path: 'search',
  version: '1',
})
@ApiTags('Search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly mostWantedService: MostWantedService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search vehicles',
    description:
      'Search and filter vehicles based on various criteria. Returns paginated results with promoted posts for engaged users.',
  })
  @ApiOkResponse({
    description: 'Search results with vehicle listings',
  })
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
  @ApiOperation({
    summary: 'Get most wanted vehicles',
    description:
      'Retrieve the list of most wanted or trending vehicles based on user search patterns',
  })
  @ApiOkResponse({
    description: 'List of most wanted vehicles',
  })
  async getMostWanted(@Query() query: MostWantedDto) {
    return this.mostWantedService.getMostWanted(query);
  }
}
