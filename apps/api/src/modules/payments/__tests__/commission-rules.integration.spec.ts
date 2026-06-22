// modules/payments/__tests__/commission-rules.integration.spec.ts
// REAL Postgres proof of the API-W3-07 commission-rule catalog. Proves:
//   1. a tenant finance admin creates a TENANT override (tenant_id = caller) with an audit row;
//   2. authorization THROWS without finance permission;
//   3. a tenant can list its own rules but NOT mutate a platform-default (tenant_id NULL) rule → 404 (no god-mode);
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's commission rule.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { AuditWriter } from '../../../core/audit/audit.writer';

import { CommissionRuleRepository } from '../repositories/commission-rule.repository';
import { CommissionRuleService } from '../services/commission-rule.service';
import { CommissionRuleForbiddenError, CommissionRuleNotFoundError } from '../domain/commission.errors';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('payments commission-rule catalog (integration, real Postgres + RLS + Law 11)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool; let rules: CommissionRuleService;
  let isSuperuser = false;
  const tenantA = randomUUID(); const tenantB = randomUUID();
  const finance = () => ({ userId: randomUUID(), canManage: true });
  const key = () => randomUUID();
  let ruleId = ''; let platformRuleId = '';

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    // a platform-default rule (tenant_id NULL) — must NOT be editable via the tenant API
    platformRuleId = randomUUID();
    await admin.query(`INSERT INTO commission_rules (id, tenant_id, rate_bps, fixed_minor, platform_share_bps, charged_to, priority) VALUES ($1, NULL, 300, 0, 1000, 'seller', 100)`, [platformRuleId]);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    rules = new CommissionRuleService(uow, new PgIdempotencyService(pools), new PromMetrics(), new AuditWriter(pools), new CommissionRuleRepository(replica as any));

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('creates a tenant override (tenant_id = caller) + audit row', async () => {
    const res = await rules.create(tenantA, finance(), key(), { rateBps: 350, fixedMinor: '0', platformShareBps: 1000, chargedTo: 'seller', priority: 50 } as any, null);
    ruleId = res.id;
    const row = await admin.query(`SELECT tenant_id, rate_bps FROM commission_rules WHERE id=$1`, [ruleId]);
    expect(row.rows[0].tenant_id).toBe(tenantA);
    expect(row.rows[0].rate_bps).toBe(350);
    const au = await admin.query(`SELECT count(*)::int c FROM audit_log WHERE tenant_id=$1 AND action='payments.commission_rule_created'`, [tenantA]);
    expect(au.rows[0].c).toBeGreaterThanOrEqual(1);
  });

  it('authorization throws without finance permission', async () => {
    await expect(rules.create(tenantA, { userId: randomUUID(), canManage: false }, key(), { rateBps: 1, fixedMinor: '0', platformShareBps: 0, chargedTo: 'seller', priority: 100 } as any, null))
      .rejects.toBeInstanceOf(CommissionRuleForbiddenError);
  });

  it('cannot mutate a platform-default rule via the tenant API → 404 (no god-mode escalation)', async () => {
    await expect(rules.setActive(tenantA, finance(), platformRuleId, false, null)).rejects.toBeInstanceOf(CommissionRuleNotFoundError);
    const row = await admin.query(`SELECT is_active FROM commission_rules WHERE id=$1`, [platformRuleId]);
    expect(row.rows[0].is_active).toBe(true);   // untouched
  });

  it('RLS: tenant B cannot see tenant A\'s commission rule', async () => {
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM commission_rules WHERE id=$1`, [ruleId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[commission-rules] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
