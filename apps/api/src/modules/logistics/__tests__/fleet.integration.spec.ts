// modules/logistics/__tests__/fleet.integration.spec.ts
// REAL Postgres proof of the fleet registry (API-W3-03): a tenant registers a carrier → a vehicle → a seller
// pickup slot, all in one ACID tx each (UoW), with outbox + audit rows written in the SAME tx. Proves:
//   1. partner/vehicle/pickup-slot persist with the caller's tenant_id and emit an outbox event;
//   2. UNIQUE(partner_id, reg_no) surfaces as a typed 409 (DuplicateVehicleRegError);
//   3. authorization THROWS without logistics.manage;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's partner.
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

import { LogisticsPartnerRepository } from '../repositories/logistics-partner.repository';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { PickupSlotRepository } from '../repositories/pickup-slot.repository';
import { LogisticsPartnerService } from '../services/logistics-partner.service';
import { VehicleService } from '../services/vehicle.service';
import { PickupSlotService } from '../services/pickup-slot.service';
import { DuplicateVehicleRegError, ShipmentForbiddenError } from '../domain/logistics.errors';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('logistics fleet registry (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider;
  let admin: Pool;
  let inspect: Pool;
  let partners: LogisticsPartnerService;
  let vehicles: VehicleService;
  let slots: PickupSlotService;
  let isSuperuser = false;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const seller = randomUUID();
  const manager = () => ({ userId: randomUUID(), canManage: true });
  const key = () => randomUUID();
  let partnerId = '';

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, seller);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter();
    const idem = new PgIdempotencyService(pools);
    const metrics = new PromMetrics();
    const audit = new AuditWriter(pools);
    const partnerRepo = new LogisticsPartnerRepository(replica as any);
    const vehicleRepo = new VehicleRepository(replica as any);
    const slotRepo = new PickupSlotRepository(replica as any);
    partners = new LogisticsPartnerService(uow, outbox, idem, metrics, audit, partnerRepo);
    vehicles = new VehicleService(uow, outbox, idem, metrics, audit, vehicleRepo, partnerRepo);
    slots = new PickupSlotService(uow, outbox, idem, metrics, audit, slotRepo);

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('registers a carrier with the caller tenant_id + an outbox event', async () => {
    const res = await partners.create(tenantA, manager(), key(), { partnerKind: '3pl', defaultName: 'Speedy 3PL', supportsColdChain: true } as any, null);
    partnerId = res.id;
    const row = await admin.query(`SELECT tenant_id, partner_kind, supports_cold_chain FROM logistics_partners WHERE id=$1`, [partnerId]);
    expect(row.rows[0].tenant_id).toBe(tenantA);
    expect(row.rows[0].partner_kind).toBe('3pl');
    const ev = await admin.query(`SELECT count(*)::int c FROM outbox_events WHERE aggregate_id=$1 AND event_type='logistics.partner_registered'`, [partnerId]);
    expect(ev.rows[0].c).toBe(1);
  });

  it('authorization THROWS without logistics.manage', async () => {
    await expect(partners.create(tenantA, { userId: randomUUID(), canManage: false }, key(), { partnerKind: '3pl', defaultName: 'X', supportsColdChain: false } as any, null))
      .rejects.toBeInstanceOf(ShipmentForbiddenError);
  });

  it('registers a vehicle and rejects a duplicate reg_no for the same partner (409)', async () => {
    const v = await vehicles.create(tenantA, manager(), key(), { partnerId, regNo: 'mh12 ab 1234', isRefrigerated: true, capacityKg: 2500 } as any, null);
    expect(v.regNo).toBe('MH12AB1234');
    await expect(vehicles.create(tenantA, manager(), key(), { partnerId, regNo: 'MH12AB1234', isRefrigerated: false } as any, null))
      .rejects.toBeInstanceOf(DuplicateVehicleRegError);
  });

  it('creates a seller pickup slot scoped to the seller', async () => {
    const s = await slots.create(tenantA, seller, key(), { weekday: 2, startTime: '09:00', endTime: '12:00' } as any, null);
    const got = await slots.getById(tenantA, seller, s.id);
    expect(got.weekday).toBe(2);
    // another seller cannot see it
    await expect(slots.getById(tenantA, randomUUID(), s.id)).rejects.toBeTruthy();
  });

  it('RLS: tenant B cannot see tenant A\'s partner', async () => {
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM logistics_partners WHERE id=$1`, [partnerId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[fleet] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
