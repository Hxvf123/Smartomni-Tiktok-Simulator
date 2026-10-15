import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PersistentBusinessClock } from '../src/clock/clock';
import { configureApp } from '../src/configure-app';
import { WebhookTransport, WorkerTime } from '../src/webhooks/webhook-worker.service';

export const ADMIN_TOKEN = 'test-admin-token-1234';

export function prepareEnv(extra: Record<string, string> = {}): void {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
  process.env.TEST_ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.WEBHOOK_WORKER_ENABLED = 'false';
  process.env.SEED_ON_START = 'false';
  process.env.MEDIA_DIR = './.tmp-test/media';
  process.env.PDF_DIR = './.tmp-test/pdf';
  Object.assign(process.env, extra);
}

export async function cleanDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "WebhookAttempt","WebhookJob","FaultRule","DemoSession","HttpRequestLog","AuthorizationCode","Token","InventoryLevel","InventoryUpdateAttempt","Sku","Product","Warehouse","Buyer","Scenario","Shop","Seller","App","ClockState" RESTART IDENTITY CASCADE`,
  );
}

export class FakeTime extends WorkerTime {
  constructor(public current: Date = new Date()) {
    super();
  }
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class FakeTransport extends WebhookTransport {
  calls: { jobId: string; attemptNo: number }[] = [];
  responses: (number | Error)[] = [];
  defaultStatus = 200;
  gate: Promise<void> | null = null;
  async send(job: { id: string }, ctx: { attemptNo: number }) {
    this.calls.push({ jobId: job.id, attemptNo: ctx.attemptNo });
    if (this.gate) await this.gate;
    const next = this.responses.shift() ?? this.defaultStatus;
    if (next instanceof Error) throw next;
    return { httpStatus: next, body: next < 300 ? 'ok' : 'error' };
  }
}

export async function createApp(opts: { transport?: FakeTransport; time?: FakeTime; env?: Record<string, string>; beforeInit?: (app: INestApplication) => void } = {}): Promise<INestApplication> {
  prepareEnv(opts.env);
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (opts.transport) builder = builder.overrideProvider(WebhookTransport).useValue(opts.transport);
  if (opts.time) builder = builder.overrideProvider(WorkerTime).useValue(opts.time);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app);
  opts.beforeInit?.(app);
  await app.init();
  // Listen once: supertest otherwise binds a fresh ephemeral port per request, and concurrent requests race (read ECONNRESET).
  await app.listen(0, '127.0.0.1');
  // The business clock row lives in the shared test database: a suite that advanced it must not leak into the next suite's app.
  await app.get(PersistentBusinessClock).reset();
  return app;
}
