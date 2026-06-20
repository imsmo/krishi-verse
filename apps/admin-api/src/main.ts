// apps/admin-api/src/main.ts · the god-mode plane process. Separate app/pods/WAF from apps/api (Law 11). URI
// versioning (/v1/...), JSON body limits, trust-proxy for accurate source IPs (the IP allowlist depends on it).
// Boot fails closed if AdminConfig.assertProductionSecurity rejects the environment.
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AdminModule } from './admin.module';
import { AdminConfig } from './core/config/admin-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AdminModule, { bodyParser: true });
  app.set('trust proxy', 1);                              // first proxy hop is ours; req.ip reflects the client
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  const config = app.get(AdminConfig);
  await app.listen(config.env.PORT);
  // eslint-disable-next-line no-console
  console.log(`[admin-api] god-mode plane listening on :${config.env.PORT} (${config.env.NODE_ENV})`);
}
void bootstrap();
