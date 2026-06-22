// modules/catalogue/__tests__/catalogue.e2e-spec.ts
// Real HTTP contract for the catalogue:
//   • the master taxonomy reads are @Public (anonymous storefront browse) → 200 with a tenant header;
//   • a write (POST /v1/products) with NO token → 401 (auth guard);
//   • a write with a token that LACKS catalogue.product.manage → 403 (RBAC throws, never silently allows).
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { bootstrapE2EApp, runE2E, adminPool, mintToken, authHeaders } from '../../../../test/e2e/bootstrap';
import { makeTenant } from '../../../../test/helpers/fixtures';

runE2E('catalogue e2e (real HTTP + Postgres)', () => {
  let app: INestApplication; let http: any; let admin: Pool;
  const tenantId = randomUUID();

  beforeAll(async () => {
    admin = adminPool();
    await makeTenant(admin, tenantId, 'CAT');
    app = await bootstrapE2EApp();
    http = app.getHttpServer();
  }, 30000);
  afterAll(async () => { await app?.close(); await admin?.end(); });

  it('public taxonomy reads return 200', async () => {
    const cats = await request(http).get('/v1/categories').set('x-tenant-id', tenantId);
    expect(cats.status).toBe(200);
    const prods = await request(http).get('/v1/products').set('x-tenant-id', tenantId);
    expect(prods.status).toBe(200);
  });

  it('a product write without a token is rejected (401)', async () => {
    const res = await request(http).post('/v1/products').set('x-tenant-id', tenantId).send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('a product write with a token lacking the manage permission is forbidden (403)', async () => {
    const token = mintToken(app, { userId: randomUUID(), tenantId, perms: [] });
    const res = await request(http).post('/v1/products').set(authHeaders(token, tenantId)).send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});
