// core/bulk/__tests__/bulk-import.integration.spec.ts
// REAL end-to-end proof against a live Postgres (migration 0030 + RLS): create a job → process a 3-row CSV
// (2 ok + 1 failing) through a fake applier + a fake object-store → assert partially_completed with the right
// counts and ONE recorded error → cross-tenant RLS: tenant B cannot see tenant A's job or its error rows.
// Uses a fake applier/object-store so the test targets the bulk machinery (the real product applier is covered
// by its unit test + the wiring). Runs only when DATABASE_URL is set.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';
import { AppConfig } from '../../config/app-config';
import { PgPoolProvider } from '../../database/pg-pool.provider';
import { ShardRouter } from '../../sharding/shard-router';
import { PgUnitOfWork } from '../../database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../database/read-replica.pg';
import { PgOutboxWriter } from '../../outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../idempotency/idempotency.service.pg';
import { PromMetrics } from '../../observability/metrics.prom';
import { AuditWriter } from '../../audit/audit.writer';
import { BulkImportJobRepository } from '../bulk-import-job.repository';
import { BulkResultStore } from '../bulk-result.store';
import { BulkApplierRegistry } from '../bulk-applier.registry';
import { BulkJobService } from '../bulk-job.service';
import { BulkImportProcessor } from '../csv-import.processor';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('bulk CSV import (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let svc: BulkJobService; let proc: BulkImportProcessor;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const user = randomUUID();
  let jobId = '';
  const actor = { userId: user, canImport: true };
  const csv = 'name\nok1\nok2\nBAD\n';

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B'); await makeUser(admin, user);
    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const repo = new BulkImportJobRepository(replica as any);
    const results = new BulkResultStore(replica as any);
    const registry = new BulkApplierRegistry();
    registry.register({ importType: 'products', requiredColumns: ['name'], applyRow: async (_c, _k, row) => { if (row.name === 'BAD') throw Object.assign(new Error('bad row'), { code: 'ROW_X' }); return { id: randomUUID() }; } });
    const audit = new AuditWriter(pools);
    svc = new BulkJobService(uow, new PgOutboxWriter(), new PgIdempotencyService(pools), new PromMetrics(), registry, audit, repo, results);
    const objectStore = { getObject: async () => Buffer.from(csv, 'utf8') } as any;
    proc = new BulkImportProcessor(uow, new PgOutboxWriter(), new PromMetrics(), objectStore, registry, repo, results);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);
  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('creates a job', async () => {
    const job: any = await svc.create(tenantA, actor, `idem-${randomUUID()}`, { importType: 'products', storageKey: 'imports/a.csv', columnMapping: {} } as any, '1.2.3.4');
    jobId = job.id;
    expect(job.status).toBe('pending');
  });

  it('processes the CSV: 2 ok + 1 failed → partially_completed with one recorded error', async () => {
    const out = await proc.process(tenantA, jobId);
    expect(out).toMatchObject({ status: 'partially_completed', succeeded: 2, failed: 1 });
    const got: any = await svc.getById(tenantA, actor, jobId);
    expect(got.succeededRows).toBe(2); expect(got.failedRows).toBe(1); expect(got.totalRows).toBe(3);
    const errs = await svc.listErrors(tenantA, actor, jobId, { limit: 100 });
    expect(errs.items.length).toBe(1);
    expect(errs.items[0].rowIndex).toBe(3);
  });

  it('RLS: tenant B cannot see tenant A\'s job or its errors', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM bulk_import_jobs WHERE id=$1`, [jobId])).rows.length).toBe(0);
    expect((await inspect.query(`SELECT id FROM bulk_import_errors WHERE job_id=$1`, [jobId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM bulk_import_jobs WHERE id=$1`, [jobId])).rows.length).toBe(1);
  });
});
