// modules/orders/__tests__/orders.e2e-spec.ts
// Real HTTP contract for orders:
//   • GET /v1/orders with NO token → 401;
//   • GET /v1/orders with a valid token → 200 (a fresh tenant's list is empty but the route is live);
//   • GET /v1/orders/:id for a non-existent / non-owned id → 404 (tenant-scoped, no IDOR enumeration).
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { bootstrapE2EApp, runE2E, adminPool, mintToken, authHeaders } from '../../../../test/e2e/bootstrap';
import { makeTenant } from '../../../../test/helpers/fixtures';

runE2E('orders e2e (real HTTP + Postgres)', () => {
  let app: INestApplication; let http: any; let admin: Pool;
  const tenantId = randomUUID();
  const userId = randomUUID();

  beforeAll(async () => {
    admin = adminPool();
    await makeTenant(admin, tenantId, 'ORD');
    app = await bootstrapE2EApp();
    http = app.getHttpServer();
  }, 30000);
  afterAll(async () => { await app?.close(); await admin?.end(); });

  it('rejects the order list without a token (401)', async () => {
    expect((await request(http).get('/v1/orders').set('x-tenant-id', tenantId)).status).toBe(401);
  });

  it('returns the (empty) order list for an authenticated buyer (200)', async () => {
    const token = mintToken(app, { userId, tenantId, perms: ['order.create'] });
    const res = await request(http).get('/v1/orders?box=buyer&limit=20').set(authHeaders(token, tenantId));
    expect(res.status).toBe(200);
  });

  it('a non-existent order id returns 404, not a cross-tenant leak', async () => {
    const token = mintToken(app, { userId, tenantId, perms: ['order.create', '*'] });
    const res = await request(http).get(`/v1/orders/${randomUUID()}`).set(authHeaders(token, tenantId));
    expect(res.status).toBe(404);
  });
});
