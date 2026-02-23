import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { LegacyDocsService } from './legacy-docs.service';

@Controller()
export class LegacyDocsController {
  constructor(private readonly service: LegacyDocsService) {}

  @Get('openapi.json')
  openApi(@Headers('x-docs-token') docsToken?: string) {
    if (!this.service.hasAccess(docsToken)) {
      throw new NotFoundException('Not found');
    }
    return this.service.getOpenApiDocument();
  }

  @Get('docs')
  docs(@Headers('x-docs-token') docsToken?: string) {
    if (!this.service.hasAccess(docsToken)) {
      throw new NotFoundException('Not found');
    }
    return {
      docs: 'openapi',
      url: '/openapi.json',
      authHeader: 'X-Docs-Token',
      message: 'Use the guarded OpenAPI URL to inspect endpoints.',
    };
  }
}
