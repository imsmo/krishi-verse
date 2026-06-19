// modules/exports/__tests__/exports.integration.spec.ts
// REAL end-to-end proof of the export-compliance spine against a live Postgres:
//   1. an exporter registers an APEDA RCMC; creates a shipment to the US (draft);
//   2. advances to docs_in_progress; adds two checklist documents (resolved from the export_doc lookup);
//   3. the docs-cleared SHIP GATE blocks 'shipped' while a doc is unverified, then allows it once all are
//      verified; the shipment runs delivered → paid → closed;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's shipment.
// Schema/seeds come from the REAL db/migrations + db/seeds (test/integration-global-setup.js).
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
import { AuditWriter } from '../../../core/audit/audit.writer';
import { QuotaService } from '../../../core/quota/quota.service';

import { ExporterRegistrationRepository } from '../repositories/exporter-registration.repository';
import { ExportShipmentRepository } from '../repositories/export-shipment.repository';
import { ExportDocumentRepository } from '../repositories/export-document.repository';
import { ExporterRegistrationService } from '../services/exporter-registration.service';
import { ExportShipmentService } from '../services/export-shipment.service';
import { ExportDocumentService } from '../services/export-document.service';
import { DocsNotClearedError } from '../domain/exports.errors';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;
class AllowAllQuota extends QuotaService { async assertWithinLimit(): Promise<void> {} async increment(): Promise<void> {} }

run('exports compliance spine (integration, real Postgres + RLS + docs ship gate)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let exporters: ExporterRegistrationService; let shipments: ExportShipmentService; let documents: ExportDocumentService;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const exporter = randomUUID();
  let shipmentId = ''; let docId1 = ''; let docId2 = '';
  const actor = { userId: exporter, canManage: true, isAdmin: false };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, exporter);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter(); const idem = new PgIdempotencyService(pools); const metrics = new PromMetrics(); const audit = new AuditWriter(pools);
    const eRepo = new ExporterRegistrationRepository(replica as any); const sRepo = new ExportShipmentRepository(replica as any); const dRepo = new ExportDocumentRepository(replica as any);
    exporters = new ExporterRegistrationService(uow, outbox, idem, metrics, eRepo);
    shipments = new ExportShipmentService(uow, outbox, idem, new AllowAllQuota(), metrics, audit, sRepo, dRepo);
    documents = new ExportDocumentService(uow, outbox, metrics, dRepo, sRepo);

    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('exporter registers an APEDA RCMC + creates a US shipment', async () => {
    await exporters.register(tenantA, actor, `idem-${randomUUID()}`, { authority: 'APEDA', regNo: 'RCMC-ABC-123', iecCode: 'ABCDE12345' } as any);
    const s = await shipments.create(tenantA, actor, `idem-${randomUUID()}`, { destinationCountry: 'US', incoterm: 'FOB', orderIds: [], totalValueMinor: '5000000', currencyCode: 'USD' } as any);
    shipmentId = s.id; expect(s.status).toBe('draft');
    expect((await shipments.advance(tenantA, actor, shipmentId, { to: 'docs_in_progress' } as any, null)).status).toBe('docs_in_progress');
  });

  it('adds two checklist documents (resolved from the export_doc lookup)', async () => {
    docId1 = (await documents.add(tenantA, actor, shipmentId, { docTypeCode: 'commercial_invoice', referenceNo: 'CI-001' } as any)).id;
    docId2 = (await documents.add(tenantA, actor, shipmentId, { docTypeCode: 'packing_list' } as any)).id;
    await shipments.advance(tenantA, actor, shipmentId, { to: 'inspection' } as any, null);
  });

  it('the docs ship-gate blocks until all documents are verified', async () => {
    await documents.setStatus(tenantA, actor, docId1, { status: 'submitted' } as any);
    await documents.setStatus(tenantA, actor, docId1, { status: 'verified' } as any);
    // docId2 still pending → cannot ship
    await expect(shipments.advance(tenantA, actor, shipmentId, { to: 'shipped' } as any, null)).rejects.toBeInstanceOf(DocsNotClearedError);
    await documents.setStatus(tenantA, actor, docId2, { status: 'submitted' } as any);
    await documents.setStatus(tenantA, actor, docId2, { status: 'verified' } as any);
    expect((await shipments.advance(tenantA, actor, shipmentId, { to: 'shipped', vesselOrAwb: 'MAEU12345' } as any, null)).status).toBe('shipped');
  });

  it('runs the rest of the lifecycle delivered → paid → closed', async () => {
    expect((await shipments.advance(tenantA, actor, shipmentId, { to: 'delivered' } as any, null)).status).toBe('delivered');
    expect((await shipments.advance(tenantA, actor, shipmentId, { to: 'paid', lcRef: 'LC-XYZ' } as any, null)).status).toBe('paid');
    expect((await shipments.advance(tenantA, actor, shipmentId, { to: 'closed' } as any, null)).status).toBe('closed');
  });

  it('RLS: tenant B cannot see tenant A\'s shipment', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM export_shipments WHERE id=$1`, [shipmentId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM export_shipments WHERE id=$1`, [shipmentId])).rows.length).toBe(1);
  });
});
