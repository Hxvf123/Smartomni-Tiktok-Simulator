import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfig } from './config/config';
import { configureApp } from './configure-app';
import { setupSwagger } from './openapi/swagger';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('bootstrap').log(`simulator API listening on :${config.port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
