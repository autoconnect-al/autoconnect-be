import { Injectable } from '@nestjs/common';
import { legacySuccess } from '../../common/legacy-response';
import { LegacySitemapService } from '../legacy-sitemap/legacy-sitemap.service';

@Injectable()
export class ApSitemapAdminService {
  constructor(private readonly legacySitemapService: LegacySitemapService) {}

  async sitemapGenerate() {
    await this.legacySitemapService.getDefaultSitemap();
    return legacySuccess(true, 'Sitemap generated successfully');
  }
}
