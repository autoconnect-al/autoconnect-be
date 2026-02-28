import { Injectable } from '@nestjs/common';
import { legacyRoutes } from './openapi-routes';

@Injectable()
export class LegacyDocsService {
  private openApiDocument: Record<string, unknown> | null = null;

  setOpenApiDocument(document: Record<string, unknown>): void {
    this.openApiDocument = document;
  }

  private expectedCode(): string {
    return process.env.DOCS_ACCESS_CODE ?? '';
  }

  hasAccess(token?: string): boolean {
    const expected = this.expectedCode();
    return Boolean(expected && token && expected === token);
  }

  getOpenApiDocument() {
    if (this.openApiDocument) {
      return this.openApiDocument;
    }

    // Fallback for non-bootstrapped contexts (e.g. isolated unit tests).
    return this.getLegacyFallbackOpenApiDocument();
  }

  private getLegacyFallbackOpenApiDocument() {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of legacyRoutes) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      const operation: Record<string, unknown> = {
        summary: route.summary,
        responses: {
          200: {
            description: 'Legacy ServiceResponse payload',
          },
        },
      };

      if (route.security) {
        operation.security = [{ XHttpAuthorization: [] }];
      }

      paths[route.path][route.method] = operation;
    }

    return {
      openapi: '3.0.3',
      info: {
        title: 'Vehicle API Legacy Compatibility',
        version: '0.1.0',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          XHttpAuthorization: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Http-Authorization',
            description: 'Use value: Bearer <jwt_token>',
          },
        },
      },
      paths,
    };
  }

  getDocsHtml(token: string) {
    const specUrl = '/openapi.json';
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vehicle API Legacy Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; }
    #swagger-ui { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      requestInterceptor: (request) => {
        request.headers['X-Docs-Token'] = ${JSON.stringify(token)};
        return request;
      },
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout'
    });
  </script>
</body>
</html>`;
  }
}
