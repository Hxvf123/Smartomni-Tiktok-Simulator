import { PathsFragment, obj, op, str } from './helpers';

export const paths: PathsFragment = {
  '/health/live': {
    get: op({
      tag: 'Health',
      summary: 'Liveness probe',
      description: 'Always returns `{status: "ok"}` while the process is up. Not logged to the HTTP log.',
      handler: 'HealthController.live',
      security: [],
      ok: { description: 'Process is alive', schema: obj({ status: str() }, ['status']), example: { status: 'ok' } },
      errorShape: 'nest',
    }),
  },
  '/health/ready': {
    get: op({
      tag: 'Health',
      summary: 'Readiness probe',
      description: 'Runs `SELECT 1` against PostgreSQL and checks that the media and PDF directories are writable. Returns 503 if any check fails.',
      handler: 'HealthController.ready',
      security: [],
      ok: {
        description: 'All checks passed',
        schema: obj({ status: str(), checks: obj({ database: str('up | down'), media: str('writable | unwritable'), pdf: str('writable | unwritable') }) }, ['status', 'checks']),
        example: { status: 'ok', checks: { database: 'up', media: 'writable', pdf: 'writable' } },
      },
      errors: { 503: 'A check failed: body is `{status: "unavailable", checks}`' },
      errorShape: 'nest',
    }),
  },
};
