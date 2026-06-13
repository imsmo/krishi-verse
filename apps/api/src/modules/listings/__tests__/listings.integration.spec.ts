// modules/listings/__tests__/listings.integration.spec.ts
// REAL end-to-end proof of the listings vertical slice against a live Postgres.
// It instantiates the CONCRETE infrastructure (PgUnitOfWork + RLS, PgOutboxWriter,
// PgQuotaService, PgIdempotencyService, replica reads) — no mocks — and verifies:
//   1. create() persists the listing AND writes listing.created to the outbox in
//      the SAME transaction (Law 4),
//   2. publish() transitions + writes listing.published,
//   3. the read-model returns the published listing off the replica path (Law 12),
//   4. idempotency: the same Idempotency-Key returns the same id (Law 3),
//   5. plan quota is enforced at the data layer (QuotaExceededError),
//   6. ROW-LEVEL SECURITY isolates tenants — tenant B cannot see tenant A's rows.
//
// Requires a Postgres reachable via DATABASE_URL (the least-privilege kv_app role).
// If DATABASE_ADMIN_URL (superuser) is set, the slice schema + role + seed are
// (re)loaded automatically. Without DATABASE_URL the whole suite is skipped so the
// fast unit suite still runs anywhere.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgQuotaService } from '../../../core/quota/quota.service.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { InMemoryCacheService } from '../../../core/cache/cache.service.in-memory';
import { PromMetrics } from '../../../core/observability/metrics.prom';

import { ListingRepository } from '../repositories/listing.repository';
import { PriceHistoryRepository } from '../repositories/price-history.repository';
import { ListingAttributeRepository } from '../repositories/listing-attribute.repository';
import { ListingMediaRepository } from '../repositories/listing-media.repository';
import { ListingSearchReadModel } from '../read-models/listing-search.read-model';
import { ListingService } from '../services/listing.service';
import { QuotaExceededError } from '../../../shared/errors/app-error';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const SQL_DIR = join(__dirname, '../../../../test/sql');

const uuid = () => randomUUID();
const baseDto = () => ({
  productId: uuid(), categoryId: uuid(), title: 'Integration Wheat',
  quantityTotal: 100, minOrderQty: 1, unitCode: 'quintal',
  priceMinor: '1440000', currencyCode: 'INR', organicClaim: 'none' as const,
  saleType: 'direct' as const, visibility: 'public' as const, attributes: [], mediaIds: [] as string[],
});

const run = APP_URL ? describe : describe.skip;

run('listings slice (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider;
  let svc: ListingService;
  let readModel: ListingSearchReadModel;
  let inspect: Pool;        // direct SELECTs for assertions (kv_app, granted)
  let isSuperuser = false;

  // each test uses a fresh tenant id so runs are isolated
  const planUnlimited = '00000000-0000-0000-0000-0000000000a1';
  const planQuota1 = '00000000-0000-0000-0000-0000000000a2';

  beforeAll(async () => {
    if (ADMIN_URL) {
      const admin = new Pool({ connectionString: ADMIN_URL });
      for (const f of ['00_listings_slice.sql', '01_app_role.sql', '02_seed_min.sql']) {
        await admin.query(readFileSync(join(SQL_DIR, f), 'utf8'));
      }
      await admin.query(`INSERT INTO plans (id,name) VALUES ($1,'Quota1 Plan') ON CONFLICT DO NOTHING`, [planQuota1]);
      await admin.query(`INSERT INTO plan_limits (plan_id,limit_code,limit_value)
        VALUES ($1,'max_listings_month',1) ON CONFLICT DO NOTHING`, [planQuota1]);
      await admin.end();
    }

    const config = new AppConfig({
      NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'test-secret-test-secret', SHARD_COUNT: '1',
    });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter();
    const quota = new PgQuotaService(pools, shards);
    const idem = new PgIdempotencyService(pools);
    const cache = new InMemoryCacheService();
    const metrics = new PromMetrics();
    const repo = new ListingRepository(replica as any);
    svc = new ListingService(uow, outbox, quota, idem, cache, metrics, repo,
      new PriceHistoryRepository(), new ListingAttributeRepository(), new ListingMediaRepository());
    readModel = new ListingSearchReadModel(replica as any, metrics);

    inspect = new Pool({ connectionString: APP_URL });
    const who = await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`);
    isSuperuser = who.rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); });

  async function activate(tenantId: string, planId: string) {
    await inspect.query(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status) VALUES ($1,$2,$3,'active')`,
      [uuid(), tenantId, planId],
    );
  }

  it('create → persists row + outbox listing.created in one tx; publish → listing.published', async () => {
    const tenant = uuid(); const seller = uuid();
    await activate(tenant, planUnlimited);

    const { id } = await svc.create(tenant, seller, `idem-${uuid()}`, baseDto());
    expect(id).toBeTruthy();

    const row = await inspect.query(`SELECT status, tenant_id FROM listings WHERE id=$1`, [id]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].status).toBe('draft');

    const created = await inspect.query(
      `SELECT 1 FROM outbox_events WHERE aggregate_id=$1 AND event_type='listing.created'`, [id]);
    expect(created.rowCount).toBe(1);

    await svc.publish(tenant, { userId: seller, canModerate: false }, id);
    const pub = await inspect.query(`SELECT status FROM listings WHERE id=$1`, [id]);
    expect(pub.rows[0].status).toBe('published');
    const published = await inspect.query(
      `SELECT 1 FROM outbox_events WHERE aggregate_id=$1 AND event_type='listing.published'`, [id]);
    expect(published.rowCount).toBe(1);

    const page = await readModel.query(tenant, { limit: 20, sort: 'newest' } as any);
    expect(page.items.map((i) => i.id)).toContain(id);
  });

  it('is idempotent — same Idempotency-Key returns the same id', async () => {
    const tenant = uuid(); const seller = uuid(); await activate(tenant, planUnlimited);
    const key = `idem-${uuid()}`;
    const a = await svc.create(tenant, seller, key, baseDto());
    const b = await svc.create(tenant, seller, key, baseDto());
    expect(a.id).toEqual(b.id);
    const cnt = await inspect.query(`SELECT count(*)::int n FROM listings WHERE tenant_id=$1`, [tenant]);
    expect(cnt.rows[0].n).toBe(1); // only ONE listing despite two calls
  });

  it('enforces plan quota at the data layer (QuotaExceededError on the 2nd create)', async () => {
    const tenant = uuid(); const seller = uuid(); await activate(tenant, planQuota1);
    await svc.create(tenant, seller, `idem-${uuid()}`, baseDto());
    await expect(svc.create(tenant, seller, `idem-${uuid()}`, baseDto()))
      .rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('RLS isolates tenants — tenant B cannot see tenant A rows', async () => {
    const tenantA = uuid(); const tenantB = uuid(); const seller = uuid();
    await activate(tenantA, planUnlimited);
    await svc.create(tenantA, seller, `idem-${uuid()}`, baseDto());

    // raw count under each tenant's RLS session (set_config app.tenant_id, is_local)
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try {
        await c.query('BEGIN');
        await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM listings`);
        await c.query('COMMIT');
        return r.rows[0].n as number;
      } finally { c.release(); }
    };

    if (isSuperuser) {
      // Superusers bypass RLS — cannot prove isolation here. CI runs as kv_app.
      // eslint-disable-next-line no-console
      console.warn('[integration] DATABASE_URL is a superuser; skipping strict RLS assertion. Use kv_app.');
      expect(await countAs(tenantA)).toBeGreaterThanOrEqual(1);
      return;
    }
    expect(await countAs(tenantA)).toBeGreaterThanOrEqual(1);
    expect(await countAs(tenantB)).toBe(0); // RLS blocks cross-tenant reads
  });
});
