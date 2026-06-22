// apps/api/test/e2e/bootstrap.ts
// Shared harness for the *.e2e-spec.ts suites: boots the REAL NestJS HTTP app (the full AppModule —
// every guard, pipe, the tenant-context middleware, the global exception filter + response interceptor)
// against the test Postgres that test/integration-global-setup.js built from the real migrations + seeds,
// and drives it over HTTP with supertest. No mocks for infra — this is the production wiring end to end.
//
// The test config is supplied via process.env BEFORE AppModule's AppConfig is constructed (AppConfig is
// the only reader of process.env; NODE_ENV='test' makes assertProductionSecurity a no-op and turns on
// exposeOtp so the OTP round-trip is testable over HTTP). The wallet is the in-process client and Redis /
// OpenSearch are Noop when their URLs are unset — so the app boots with just the DB + JWT secrets, no
// external services. Gated on DATABASE_URL: with no test DB the suites describe.skip (run anywhere fast).
import 'reflect-metadata';
import { INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/core/auth/token.service';

export const APP_URL = process.env.DATABASE_URL;
export const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
/** describe-or-skip: e2e needs the test DB the integration globalSetup builds. */
export const runE2E = APP_URL ? describe : describe.skip;

/** Boot the full app on an ephemeral port-less HTTP adapter (supertest drives app.getHttpServer()). */
export async function bootstrapE2EApp(): Promise<INestApplication> {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'e2e-access-secret-e2e-access-secret';
  process.env.AUTH_HASH_PEPPER = process.env.AUTH_HASH_PEPPER || 'e2e-hash-pepper-e2e-hash-pepper-32';
  process.env.SHARD_COUNT = process.env.SHARD_COUNT || '1';
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  return app;
}

/** A privileged pool for seeding test rows (mirrors the integration specs: DDL-capable admin role). */
export function adminPool(): Pool {
  return new Pool({ connectionString: ADMIN_URL ?? APP_URL });
}

/** Mint a real access token for a seeded user — the SAME path login uses (server-resolved perms snapshot,
 *  HS256, iss/aud), so it verifies through the live TenantResolver/AuthGuard exactly like production. */
export function mintToken(app: INestApplication, input: { userId: string; tenantId: string; perms?: string[]; roles?: string[]; sessionId?: string }): string {
  const tokens = app.get(TokenService);
  return tokens.mintAccessToken({
    sub: input.userId, tid: input.tenantId, sid: input.sessionId ?? 'e2e-session',
    roles: input.roles ?? [], perms: input.perms ?? [],
  });
}

/** Bearer + tenant headers for an authenticated request. */
export function authHeaders(token: string, tenantId: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
}

/** Turn a feature flag fully ON (rollout 100, no targeting) so a flag-gated route is reachable in e2e. */
export async function enableFlag(admin: Pool, key: string, description = 'e2e'): Promise<void> {
  await admin.query(
    `INSERT INTO feature_flags (key, description, is_enabled, rollout_pct, rules)
     VALUES ($1,$2,true,100,'{}'::jsonb)
     ON CONFLICT (key) DO UPDATE SET is_enabled=true, rollout_pct=100, rules='{}'::jsonb`,
    [key, description]);
}
