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
  // rawBody:true preserves the exact request bytes (req.rawBody) so payment-gateway webhook
  // HMAC signatures can be verified over the original payload (re-serializing would break them).
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(AppConfig);
  // Trust exactly the configured number of proxy/LB hops so req.ip reflects the REAL
  // client (not the load balancer) — required for correct, non-spoofable rate limiting.
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxyHops);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`Krishi-Verse API listening on :${config.port} (${config.nodeEnv})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FATAL: API failed to start', err);
  process.exit(1);
});
