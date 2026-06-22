// apps/api/test/e2e/smoke.e2e-spec.ts
// Boot the full app and prove the spine works over real HTTP: the public health probe answers, and an
// unauthenticated hit on a protected route is rejected (401) — i.e. the auth guard is actually wired into
// the pipeline. Gated on DATABASE_URL (the test DB the integration globalSetup builds).
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { bootstrapE2EApp, runE2E } from './bootstrap';

runE2E('smoke e2e (real HTTP, full app)', () => {
  let app: INestApplication;
  let http: any;
  beforeAll(async () => { app = await bootstrapE2EApp(); http = app.getHttpServer(); }, 30000);
  afterAll(async () => { await app?.close(); });

  it('GET /v1/healthz is public and returns 200', async () => {
    const res = await request(http).get('/v1/healthz');
    expect(res.status).toBe(200);
  });

  it('a protected route without a token is rejected (401)', async () => {
    const res = await request(http).get('/v1/users/me');
    expect(res.status).toBe(401);
  });
});
