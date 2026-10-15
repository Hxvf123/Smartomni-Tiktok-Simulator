import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument } from './build-document';

/** Swagger UI at /api-docs, raw OpenAPI JSON at /api-docs-json. Served by the API itself; no auth (documentation only, no secrets). */
export function setupSwagger(app: INestApplication): void {
  // The spec is hand-written (routes use zod, not DTO classes), so it is passed as-is instead of being scanned from decorators.
  SwaggerModule.setup('api-docs', app, buildOpenApiDocument() as never, {
    jsonDocumentUrl: 'api-docs-json',
    customSiteTitle: 'SmartOmni TikTok Simulator API',
    swaggerOptions: { persistAuthorization: false, docExpansion: 'none' },
  });
}
