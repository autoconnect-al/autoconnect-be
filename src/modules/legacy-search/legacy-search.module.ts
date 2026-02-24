import { Module } from '@nestjs/common';
import { LegacySearchController } from './legacy-search.controller';
import { LegacySearchService } from './legacy-search.service';
import { LegacySearchQueryBuilder } from './legacy-search-query-builder';

@Module({
  controllers: [LegacySearchController],
  providers: [LegacySearchService, LegacySearchQueryBuilder],
})
export class LegacySearchModule {}
