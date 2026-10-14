import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CoreModule } from './app.module';
import { SeedService } from './seed/seed.service';

/** `npm run seed`: apply the deterministic seed once without starting the HTTP server or worker. */
async function main(): Promise<void> {
  process.env.WEBHOOK_WORKER_ENABLED = 'false';
  process.env.SEED_ON_START = 'false';
  const ctx = await NestFactory.createApplicationContext(CoreModule, { logger: ['error', 'warn', 'log'] });
  const summary = await ctx.get(SeedService).seedAll();
  console.log(JSON.stringify(summary));
  await ctx.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
