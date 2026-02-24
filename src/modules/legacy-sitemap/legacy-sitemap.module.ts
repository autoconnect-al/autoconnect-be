import { Module } from '@nestjs/common';
import { LegacySitemapController } from './legacy-sitemap.controller';
import { LegacySitemapService } from './legacy-sitemap.service';

@Module({
  controllers: [LegacySitemapController],
  providers: [LegacySitemapService],
})
export class LegacySitemapModule {}
