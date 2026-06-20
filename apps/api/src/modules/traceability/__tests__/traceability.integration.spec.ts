// modules/traceability/__tests__/traceability.integration.spec.ts
// REAL end-to-end proof of the traceability spine against a live Postgres (incl. the 0028 trace_scan function):
//   1. a farmer opens a lot (genesis event) + appends a hash-chained journey;
//   2. the public scan (no tenant context) returns the curated provenance — and NO PII (tenant_id / farmer id);
//   3. ROW-LEVEL SECURITY: tenant B cannot see tenant A's lot via a normal query.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';
import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { FlagsService } from '../../../core/feature-flags/flags.service';
import { InMemoryCacheService } from '../../../core/cache/cache.service.in-memory';
import { TraceLotRepository } from '../repositories/trace-lot.repository';
import { TraceEventRepository } from '../repositories/trace-event.repository';
import { TraceLotService } from '../services/trace-lot.service';
import { PublicScanService } from '../services/public-scan.service';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('traceability spine (integration, real Postgres + RLS + public scan)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool; let uow: PgUnitOfWork;
  let lots: TraceLotService; let scan: PublicScanService;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const farmer = randomUUID();
  let lotId = ''; let qrToken = '';
  const actor = { userId: farmer, canManage: true };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B'); await makeUser(admin, farmer);
    await admin.query(`UPDATE feature_flags SET is_enabled=true WHERE key='traceability'`);
    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const lotRepo = new TraceLotRepository(replica as any); const eventRepo = new TraceEventRepository(replica as any);
    lots = new TraceLotService(uow, new PgOutboxWriter(), new PgIdempotencyService(pools), new PromMetrics(), lotRepo, eventRepo);
    const flags = new FlagsService(pools as any, new InMemoryCacheService());
    scan = new PublicScanService(uow, new PromMetrics(), flags, lotRepo);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);
  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('opens a lot + appends a hash-chained journey', async () => {
    const lot: any = await lots.create(tenantA, actor, `idem-${randomUUID()}`, { declaredInputs: [{ input: 'urea' }], certificateIds: [] } as any);
    lotId = lot.id; qrToken = lot.qrToken;
    await lots.appendEvent(tenantA, actor, lotId, 'sold', { buyer: 'anon' });
    await lots.appendEvent(tenantA, actor, lotId, 'delivered', {});
    const { items } = await lots.listEvents(tenantA, actor, lotId, { limit: 50 });
    expect(items.length).toBe(3);   // genesis(harvested) + sold + delivered
    expect(items.every((e: any) => /^[0-9a-f]{64}$/.test(e.eventHash))).toBe(true);
  });
  it('public scan returns the provenance with NO tenant_id / farmer PII', async () => {
    const prov: any = await scan.scan(qrToken);
    expect(prov.qrToken).toBe(qrToken); expect(prov.events.length).toBe(3);
    const json = JSON.stringify(prov);
    expect(json).not.toContain(tenantA);   // no tenant id
    expect(json).not.toContain(farmer);    // no farmer user id
  });
  it('an unknown / disabled token 404s', async () => {
    await expect(scan.scan('NONEXISTENTTOKEN')).rejects.toMatchObject({ code: 'TRACE_SCAN_NOT_FOUND' });
  });
  it('RLS: tenant B cannot see tenant A\'s lot via a normal query', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM trace_lots WHERE id=$1`, [lotId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM trace_lots WHERE id=$1`, [lotId])).rows.length).toBe(1);
  });
});
