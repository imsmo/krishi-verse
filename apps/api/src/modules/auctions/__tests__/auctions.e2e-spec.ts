// modules/auctions/__tests__/auctions.e2e-spec.ts
// Real HTTP contract for auctions (flag-gated feature, Law 10):
//   • GET /v1/auctions with NO token → 401 (auth before the flag gate);
//   • with the `auctions` flag ON (enabled in the DB BEFORE the app boots, so the 30s flag cache
//     warms to ON on first read) a valid token can list auctions → 200.
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { bootstrapE2EApp, runE2E, adminPool, mintToken, authHeaders, enableFlag } from '../../../../test/e2e/bootstrap';
import { makeTenant } from '../../../../test/helpers/fixtures';

runE2E('auctions e2e (real HTTP + Postgres)', () => {
  let app: INestApplication; let http: any; let admin: Pool;
  const tenantId = randomUUID();

  beforeAll(async () => {
    admin = adminPool();
    await makeTenant(admin, tenantId, 'AUC');
    await enableFlag(admin, 'auctions');   // ON before boot → first flag read caches ON
    app = await bootstrapE2EApp();
    http = app.getHttpServer();
  }, 30000);
  afterAll(async () => { await app?.close(); await admin?.end(); });

  it('rejects the auction list without a token (401), auth before the flag gate', async () => {
    expect((await request(http).get('/v1/auctions?limit=20').set('x-tenant-id', tenantId)).status).toBe(401);
  });

  it('lists auctions for an authenticated caller when the flag is ON (200)', async () => {
    const token = mintToken(app, { userId: randomUUID(), tenantId, perms: [] });
    const res = await request(http).get('/v1/auctions?limit=20').set(authHeaders(token, tenantId));
    expect(res.status).toBe(200);
  });
});
