// modules/payments/__tests__/payments.e2e-spec.ts
// Real HTTP contract for payments, focused on the gate ordering (Law 10):
//   • GET /v1/payments with NO token → 401 (AuthGuard runs before the feature-flag guard);
//   • GET /v1/payments with a valid token while the `online_payments` flag is OFF (default) → 404
//     (a disabled feature is INVISIBLE, never "exists but forbidden"). This spec deliberately never
//     enables the flag, so the off-state is deterministic regardless of test order.
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { bootstrapE2EApp, runE2E, adminPool, mintToken, authHeaders } from '../../../../test/e2e/bootstrap';
import { makeTenant } from '../../../../test/helpers/fixtures';

runE2E('payments e2e (real HTTP + Postgres)', () => {
  let app: INestApplication; let http: any; let admin: Pool;
  const tenantId = randomUUID();

  beforeAll(async () => {
    admin = adminPool();
    await makeTenant(admin, tenantId, 'PAY');
    app = await bootstrapE2EApp();
    http = app.getHttpServer();
  }, 30000);
  afterAll(async () => { await app?.close(); await admin?.end(); });

  it('rejects without a token (401), auth before the flag gate', async () => {
    expect((await request(http).get('/v1/payments').set('x-tenant-id', tenantId)).status).toBe(401);
  });

  it('is invisible (404) to an authenticated caller while online_payments is OFF', async () => {
    const token = mintToken(app, { userId: randomUUID(), tenantId, perms: [] });
    const res = await request(http).get('/v1/payments').set(authHeaders(token, tenantId));
    expect(res.status).toBe(404);
  });
});
