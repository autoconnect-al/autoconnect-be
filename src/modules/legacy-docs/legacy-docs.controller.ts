import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { LegacyDocsService } from './legacy-docs.service';

@Controller()
export class LegacyDocsController {
  constructor(private readonly service: LegacyDocsService) {}

  @Get('openapi.json')
  openApi(@Query('code') code?: string) {
    if (!this.service.hasAccess(code)) {
      throw new NotFoundException('Not found');
    }
    return this.service.getOpenApiDocument();
  }

  @Get('docs')
  docs(@Query('code') code?: string) {
    if (!this.service.hasAccess(code)) {
      throw new NotFoundException('Not found');
    }
    return {
      docs: 'openapi',
      url: `/openapi.json?code=${encodeURIComponent(code ?? '')}`,
      message: 'Use the guarded OpenAPI URL to inspect endpoints.',
    };
  }
}
