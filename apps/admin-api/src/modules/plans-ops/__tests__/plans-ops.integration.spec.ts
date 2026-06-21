// apps/admin-api/src/modules/plans-ops/__tests__/plans-ops.integration.spec.ts
// REAL end-to-end proof against a live Postgres (schema apps/api builds + migrations 0002/0037). Proves: create a
// plan (DRAFT) → set a limit + a feature → publish → version (clone to v2, composition copied) → archive —
// asserting plans state, the status lifecycle, plan_features/plan_limits, plan_changes timeline, and audit_log
// rows; and that a published plan's composition is immutable. plans + plan_changes are GLOBAL/god-mode (no
// tenant_id ⇒ no RLS — kv_admin-only; isolation asserted by verify-rls-coverage.js). Runs only when
// DATABASE_ADMIN_URL is set (CI's DB job).
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { PlansRepository } from '../repositories/plans.repository';
import { PlanCrudService } from '../services/plan-crud.service';
import { CustomPricingService } from '../services/custom-pricing.service';
import { PlanAssignmentService } from '../services/plan-assignment.service';
import { PlanImmutableError } from '../domain/plans-ops.errors';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

run('plans-ops (integration, real Postgres — plan catalogue lifecycle + versioning)', () => {
  let pool: AdminPool; let inspect: Pool;
  let crud: PlanCrudService; let pricing: CustomPricingService; let assign: PlanAssignmentService;
  const actor = { userId: randomUUID(), roles: ['platform_plans_ops'], amr: ['hwk'], authTimeSec: Math.floor(Date.now() / 1000), sessionId: '', permissions: new Set(['plans.manage']), ip: '10.0.0.1', requestId: 'itest' } as any;
  const code = `itest_${Date.now()}`;
  const featureCode = `itest_feat_${Date.now()}`;
  let planId = ''; let v2Id = '';

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    const audit = new AdminAuditWriter(pool);
    const repo = new PlansRepository(pool);
    crud = new PlanCrudService(pool, audit, repo);
    pricing = new CustomPricingService(pool, audit, repo);
    assign = new PlanAssignmentService(pool, audit, repo);
    inspect = new Pool({ connectionString: APP_URL });
    await inspect.query(`INSERT INTO features (code, default_name) VALUES ($1,'itest feature') ON CONFLICT (code) DO NOTHING`, [featureCode]);
  }, 30000);

  afterAll(async () => {
    if (inspect) {
      for (const id of [planId, v2Id].filter(Boolean)) {
        await inspect.query(`DELETE FROM plan_changes WHERE plan_id=$1`, [id]).catch(() => undefined);
        await inspect.query(`DELETE FROM plan_features WHERE plan_id=$1`, [id]).catch(() => undefined);
        await inspect.query(`DELETE FROM plan_limits WHERE plan_id=$1`, [id]).catch(() => undefined);
      }
      await inspect.query(`DELETE FROM plans WHERE code=$1`, [code]).catch(() => undefined);
      await inspect.query(`DELETE FROM features WHERE code=$1`, [featureCode]).catch(() => undefined);
      await inspect.end();
    }
    await pool?.onModuleDestroy();
  });

  it('create→compose→publish→version→archive: state, composition, history + audit; published is immutable', async () => {
    const created: any = await crud.create(actor, { code, defaultName: 'ITest Plan', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '499900', annualPriceMinor: '4999900', setupFeeMinor: '0', isPublic: true, reason: 'new plan' });
    planId = created.id;
    expect(created.status).toBe('draft');

    await assign.setLimit(actor, planId, 'max_farmers', { limitValue: '1000', reason: 'cap farmers' });
    await assign.setFeature(actor, planId, featureCode, { isIncluded: true, reason: 'enable feature' });
    await crud.updateLifecycle(actor, planId, { action: 'publish', reason: 'go live' });

    let row = await inspect.query(`SELECT status, is_active FROM plans WHERE id=$1`, [planId]);
    expect(row.rows[0].status).toBe('active');
    expect(row.rows[0].is_active).toBe(true);

    // published ⇒ composition immutable
    await expect(assign.setLimit(actor, planId, 'max_farmers', { limitValue: '2000', reason: 'bump' })).rejects.toBeInstanceOf(PlanImmutableError);

    // version → v2 draft, composition cloned
    const v2: any = await pricing.version(actor, planId, { monthlyPriceMinor: '599900', annualPriceMinor: '5999900', setupFeeMinor: '0', reason: 'price increase' });
    v2Id = v2.id;
    expect(v2.version).toBe(2);
    expect(v2.status).toBe('draft');
    const v2limits = await inspect.query(`SELECT limit_value FROM plan_limits WHERE plan_id=$1 AND limit_code='max_farmers'`, [v2Id]);
    expect(String(v2limits.rows[0].limit_value)).toBe('1000');   // cloned from v1
    const v2feat = await inspect.query(`SELECT 1 FROM plan_features WHERE plan_id=$1 AND feature_code=$2`, [v2Id, featureCode]);
    expect(v2feat.rowCount).toBe(1);

    await crud.updateLifecycle(actor, planId, { action: 'archive', reason: 'superseded by v2' });
    row = await inspect.query(`SELECT status, is_active FROM plans WHERE id=$1`, [planId]);
    expect(row.rows[0].status).toBe('archived');
    expect(row.rows[0].is_active).toBe(false);

    const changes = await inspect.query(`SELECT count(*)::int AS c FROM plan_changes WHERE plan_id=$1 AND action IN ('created','limit_set','feature_set','published','archived')`, [planId]);
    expect(changes.rows[0].c).toBe(5);
    const audits = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action LIKE 'plans.%'`, [planId]);
    expect(audits.rows[0].c).toBe(5);   // created + limit_set + feature_set + published + archived (failed immutable bump wrote nothing)
  });
});
