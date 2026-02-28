import { Controller, Get, HttpException, Query } from '@nestjs/common';
import { LegacyFavouritesService } from './legacy-favourites.service';

@Controller('favourites')
export class LegacyFavouritesController {
  constructor(private readonly service: LegacyFavouritesService) {}

  @Get('check')
  async check(@Query('favourites') favourites?: string) {
    const result = await this.service.checkFavourites(favourites);
    if (!result.success && result.statusCode === '500') {
      throw new HttpException(
        result as unknown as Record<string, unknown>,
        500,
      );
    }
    return result;
  }

  @Get('get')
  async get(@Query('favourites') favourites?: string) {
    const result = await this.service.getFavourites(favourites);
    if (!result.success && result.statusCode === '500') {
      throw new HttpException(
        result as unknown as Record<string, unknown>,
        500,
      );
    }
    return result;
  }
}
