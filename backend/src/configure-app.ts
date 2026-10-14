import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';

/** Shared by main.ts and e2e tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  const http = app as NestExpressApplication;
  http.use(
    express.json({
      limit: '1mb',
      type: ['application/json', 'application/*+json'],
      // Keep the exact bytes: the API signature covers the raw request body, not a re-serialised one.
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  http.use(express.urlencoded({ extended: true, limit: '1mb' }));
  http.disable('x-powered-by');
}
