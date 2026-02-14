import { Module } from '@nestjs/common';
import { LegacySearchController } from './legacy-search.controller';
import { LegacySearchService } from './legacy-search.service';

@Module({
  controllers: [LegacySearchController],
  providers: [LegacySearchService],
})
export class LegacySearchModule {}
