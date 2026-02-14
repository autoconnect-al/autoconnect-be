import { Controller, Get, Header, HttpCode, Query } from '@nestjs/common';
import { LegacyDocsService } from './legacy-docs.service';

@Controller()
export class LegacyDocsController {
  constructor(private readonly service: LegacyDocsService) {}

  @Get('openapi.json')
  @HttpCode(404)
  openApi(@Query('code') code?: string) {
    if (!this.service.hasAccess(code)) {
      return 'Not found';
    }
    return this.service.getOpenApiDocument();
  }

  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  docs(@Query('code') code?: string) {
    if (!this.service.hasAccess(code)) {
      return 'Not found';
    }
    return this.service.getDocsHtml(code ?? '');
  }
}
