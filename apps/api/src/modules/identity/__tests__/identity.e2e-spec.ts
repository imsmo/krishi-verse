// modules/identity/__tests__/identity.e2e-spec.ts
// Real HTTP-through-the-app proof of the identity contract against the live test Postgres:
//   1. an unauthenticated protected route → 401 (auth guard wired);
//   2. the full phone-OTP login: POST /v1/auth/otp (public) → devCode (exposeOtp in test) →
//      POST /v1/auth/verify registers the user + issues an access + refresh token → the access token
//      authorises GET /v1/users/me (the token verifies through the real TenantResolver/AuthGuard);
//   3. tenant isolation / no-IDOR: GET /v1/users/:id for a non-member id → 404 (not 403), with the
//      Report permission, so an attacker can't enumerate users across tenants.
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { bootstrapE2EApp, runE2E, adminPool, mintToken, authHeaders } from '../../../../test/e2e/bootstrap';
import { makeTenant } from '../../../../test/helpers/fixtures';

runE2E('identity e2e (real HTTP + Postgres)', () => {
  let app: INestApplication; let http: any; let admin: Pool;
  const tenantId = randomUUID();
  const phone = '+9197' + Math.floor(10000000 + Math.random() * 89999999);

  beforeAll(async () => {
    admin = adminPool();
    await makeTenant(admin, tenantId, 'E2E');
    app = await bootstrapE2EApp();
    http = app.getHttpServer();
  }, 30000);
  afterAll(async () => { await app?.close(); await admin?.end(); });

  it('rejects an unauthenticated protected route (401)', async () => {
    expect((await request(http).get('/v1/users/me').set('x-tenant-id', tenantId)).status).toBe(401);
  });

  it('OTP → verify → token → /users/me (full login over HTTP)', async () => {
    const otp = await request(http).post('/v1/auth/otp').send({ phone, channel: 'sms' });
    expect(otp.status).toBeLessThan(300);
    const devCode = otp.body?.data?.devCode;            // exposed only because NODE_ENV=test
    expect(devCode).toMatch(/^\d{4,8}$/);

    const verify = await request(http).post('/v1/auth/verify').send({ phone, code: devCode, tenantId, fullName: 'E2E User' });
    expect(verify.status).toBeLessThan(300);
    const accessToken = verify.body?.data?.accessToken;
    expect(typeof accessToken).toBe('string');
    expect(typeof verify.body?.data?.refreshToken).toBe('string');

    const me = await request(http).get('/v1/users/me').set(authHeaders(accessToken, tenantId));
    expect(me.status).toBe(200);
  });

  it('no-IDOR: reading a non-member user id returns 404, not 403', async () => {
    // a token that DOES carry the read permission — so a 403 would only come from RBAC, not membership.
    const token = mintToken(app, { userId: randomUUID(), tenantId, perms: ['identity.user.report', '*'] });
    const res = await request(http).get(`/v1/users/${randomUUID()}`).set(authHeaders(token, tenantId));
    expect(res.status).toBe(404);
  });
});
