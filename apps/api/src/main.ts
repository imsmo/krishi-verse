// apps/api/src/main.ts · API bootstrap
// Boots the NestJS HTTP app: URI versioning (/v1/...), JSON body limits sized for
// listing payloads, graceful shutdown so in-flight transactions finish on deploy.
// Env is validated at construction of AppConfig — a bad/missing var crashes here,
// loudly, not at 2 AM mid-request.
import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './core/config/app-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  const config = app.get(AppConfig);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`Krishi-Verse API listening on :${config.port} (${config.nodeEnv})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FATAL: API failed to start', err);
  process.exit(1);
});
