import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { LegacySearchService } from './legacy-search.service';
import type { LegacyResponse } from '../../common/legacy-response';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('car-details')
export class LegacySearchController {
  constructor(private readonly service: LegacySearchService) {}

  private throwLegacy(response: LegacyResponse, status?: number) {
    throw new HttpException(
      {
        success: false,
        message: response.message,
        statusCode: response.statusCode,
      },
      status ?? (Number(response.statusCode) || 500),
    );
  }

  @Post('search')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async search(@Body('filter') filter?: string) {
    const response = await this.service.search(filter);
    if (!response.success) this.throwLegacy(response, 500);
    return response;
  }

  @Post('price-calculate')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async priceCalculate(@Body('filter') filter?: string) {
    const response = await this.service.priceCalculate(filter);
    if (!response.success) this.throwLegacy(response, 500);
    return response;
  }

  @Get('most-wanted')
  async mostWanted(
    @Query('excludeIds') excludeIds?: string,
    @Query('excludedAccounts') excludedAccounts?: string,
  ) {
    const response = await this.service.mostWanted(
      excludeIds,
      excludedAccounts,
    );
    if (!response.success) this.throwLegacy(response, 500);
    return response;
  }

  @Post('result-count')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async countResults(@Body('filter') filter?: string) {
    const response = await this.service.countResults(filter);
    if (!response.success) this.throwLegacy(response, 500);
    const count = Number(response.result ?? 0);
    if (count < 801) return response;
    if (count > 801 && count < 1000) {
      return { ...response, result: count + 500 };
    }
    if (count > 1000 && count < 2000) {
      return { ...response, result: count + 1200 };
    }
    return { ...response, result: count + 5000 };
  }

  @Get('post/:id')
  async getCarDetails(@Param('id') id: string) {
    const response = await this.service.getCarDetails(id);
    if (!response.success) this.throwLegacy(response, 404);
    return response;
  }

  @Get('post/caption/:id')
  async getCaption(@Param('id') id: string) {
    const response = await this.service.getCaption(id);
    if (!response.success) this.throwLegacy(response, 404);
    return response;
  }

  @Get('related-post/:id')
  relatedById(
    @Param('id') id: string,
    @Query('type') type = 'car',
    @Query('excludedIds') excludedIds?: string,
  ) {
    return this.service.relatedById(id, type, excludedIds);
  }

  @Post('related-post-filter')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  relatedByFilter(
    @Body('filter') filter?: string,
    @Query('type') type = 'car',
    @Query('excludedIds') excludedIds?: string,
  ) {
    if (!filter) {
      this.throwLegacy(
        {
          success: false,
          message: 'An error occurred while getting related searches',
          statusCode: '500',
        },
        500,
      );
    }
    return this.service.relatedByFilter(filter, type, excludedIds);
  }
}
