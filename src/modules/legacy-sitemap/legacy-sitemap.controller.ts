import { Controller, Get, Param } from '@nestjs/common';
import { LegacySitemapService } from './legacy-sitemap.service';

@Controller('sitemap')
export class LegacySitemapController {
  constructor(private readonly service: LegacySitemapService) {}

  @Get('data')
  getSitemapData() {
    return this.service.getDefaultSitemap();
  }

  @Get('get-sitemap/:appName')
  getSitemapForApp(@Param('appName') appName: string) {
    return this.service.getSitemapForApp(appName);
  }
}
