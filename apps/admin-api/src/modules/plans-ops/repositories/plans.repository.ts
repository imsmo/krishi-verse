// apps/admin-api/src/modules/plans-ops/repositories/plans.repository.ts · ALL SQL for plans-ops. READS: plans
// (keyset list + single + FOR UPDATE), a plan's composition (plan_features + plan_limits), the feature catalogue,
// and plan_changes (keyset history). WRITES (in the caller's tx): insert a plan (version), lifecycle/pricing/
// visibility update, clone composition into a new version, upsert/remove a plan_feature / plan_limit, append a
// change-history row. plans + plan_changes are GLOBAL/god-mode (no tenant_id) — operated only by kv_admin, every
// action audited. Money is bigint, surfaced as STRING minor units (never floated). Parameterised; keyset; bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { Plan, PlanProps } from '../domain/plan.entity';
import { PlanStatus } from '../domain/plan.state';
import { PlanVersionExistsError } from '../domain/plans-ops.errors';

const COLS = `id, code, version, default_name, country_code, currency_code, monthly_price_minor, annual_price_minor, setup_fee_minor, is_public, is_active, status, created_at`;
function toPlan(r: any): Plan {
  const props: PlanProps = {
    id: r.id, code: r.code, version: r.version, defaultName: r.default_name, countryCode: r.country_code, currencyCode: r.currency_code,
    monthlyPriceMinor: BigInt(r.monthly_price_minor), annualPriceMinor: BigInt(r.annual_price_minor), setupFeeMinor: BigInt(r.setup_fee_minor),
    isPublic: r.is_public, isActive: r.is_active, status: r.status as PlanStatus, createdAt: r.created_at ?? null,
  };
  return Plan.rehydrate(props);
}

export interface PlanListQuery { code?: string; country?: string; status?: PlanStatus; publicOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }
export interface ChangeListQuery { planId: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class PlansRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ---------------- plans ---------------- */
  async listPlans(q: PlanListQuery): Promise<Plan[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.code) where += ` AND code=${p(q.code)}`;
    if (q.country) where += ` AND country_code=${p(q.country)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.publicOnly) where += ` AND is_public=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM plans WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toPlan);
  }

  async getPlan(id: string): Promise<Plan | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM plans WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toPlan(r.rows[0]) : null;
  }
  async getPlanForUpdate(client: PoolClient, id: string): Promise<Plan | null> {
    const r = await client.query(`SELECT ${COLS} FROM plans WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toPlan(r.rows[0]) : null;
  }

  /** Composition (features + limits) for a plan; limits as STRING minor/quantity values. */
  async getComposition(id: string): Promise<{ features: { code: string; isIncluded: boolean; config: unknown }[]; limits: Record<string, string> }> {
    const f = await this.pool.query(`SELECT feature_code, is_included, config FROM plan_features WHERE plan_id=$1 ORDER BY feature_code`, [id]);
    const l = await this.pool.query(`SELECT limit_code, limit_value FROM plan_limits WHERE plan_id=$1 ORDER BY limit_code`, [id]);
    const limits: Record<string, string> = {};
    for (const row of l.rows) limits[row.limit_code] = String(row.limit_value);
    return { features: f.rows.map((x: any) => ({ code: x.feature_code, isIncluded: x.is_included, config: x.config ?? {} })), limits };
  }

  async maxVersion(code: string, countryCode: string): Promise<number> {
    const r = await this.pool.query(`SELECT COALESCE(MAX(version),0)::int AS v FROM plans WHERE code=$1 AND country_code=$2`, [code, countryCode]);
    return r.rows[0]?.v ?? 0;
  }

  /** Insert a plan version. On (code, version, country) conflict → typed 409. */
  async insertPlan(client: PoolClient, plan: Plan, actorUserId: string): Promise<Plan> {
    const p = plan.toProps();
    const r = await client.query(
      `INSERT INTO plans (id, code, version, default_name, country_code, currency_code, monthly_price_minor, annual_price_minor, setup_fee_minor, is_public, is_active, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (code, version, country_code) DO NOTHING
       RETURNING ${COLS}`,
      [p.id, p.code, p.version, p.defaultName, p.countryCode, p.currencyCode, p.monthlyPriceMinor.toString(), p.annualPriceMinor.toString(), p.setupFeeMinor.toString(), p.isPublic, p.isActive, p.status, actorUserId]);
    if (!r.rows[0]) throw new PlanVersionExistsError(p.code, p.version, p.countryCode);
    return toPlan(r.rows[0]);
  }

  async updateLifecycle(client: PoolClient, id: string, status: PlanStatus, isActive: boolean, actorUserId: string): Promise<void> {
    await client.query(`UPDATE plans SET status=$2, is_active=$3, updated_by=$4, updated_at=now() WHERE id=$1`, [id, status, isActive, actorUserId]);
  }
  async updatePricing(client: PoolClient, id: string, monthly: bigint, annual: bigint, setup: bigint, actorUserId: string): Promise<void> {
    await client.query(`UPDATE plans SET monthly_price_minor=$2, annual_price_minor=$3, setup_fee_minor=$4, updated_by=$5, updated_at=now() WHERE id=$1`,
      [id, monthly.toString(), annual.toString(), setup.toString(), actorUserId]);
  }
  async updateVisibility(client: PoolClient, id: string, isPublic: boolean, actorUserId: string): Promise<void> {
    await client.query(`UPDATE plans SET is_public=$2, updated_by=$3, updated_at=now() WHERE id=$1`, [id, isPublic, actorUserId]);
  }

  /** Clone plan_features + plan_limits from one plan version to another (for versioning). */
  async cloneComposition(client: PoolClient, fromId: string, toId: string): Promise<void> {
    await client.query(`INSERT INTO plan_features (plan_id, feature_code, is_included, config) SELECT $2, feature_code, is_included, config FROM plan_features WHERE plan_id=$1 ON CONFLICT (plan_id, feature_code) DO NOTHING`, [fromId, toId]);
    await client.query(`INSERT INTO plan_limits (plan_id, limit_code, limit_value) SELECT $2, limit_code, limit_value FROM plan_limits WHERE plan_id=$1 ON CONFLICT (plan_id, limit_code) DO NOTHING`, [fromId, toId]);
  }

  /* ---------------- features / limits ---------------- */
  async featureExists(code: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM features WHERE code=$1`, [code]);
    return (r.rowCount ?? 0) > 0;
  }
  async listFeatureCatalogue(): Promise<{ code: string; defaultName: string; moduleCode: string | null }[]> {
    const r = await this.pool.query(`SELECT code, default_name, module_code FROM features ORDER BY code LIMIT 500`);
    return r.rows.map((x: any) => ({ code: x.code, defaultName: x.default_name, moduleCode: x.module_code ?? null }));
  }
  async upsertFeature(client: PoolClient, planId: string, code: string, isIncluded: boolean, config: unknown): Promise<void> {
    await client.query(
      `INSERT INTO plan_features (plan_id, feature_code, is_included, config) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (plan_id, feature_code) DO UPDATE SET is_included=EXCLUDED.is_included, config=EXCLUDED.config`,
      [planId, code, isIncluded, JSON.stringify(config ?? {})]);
  }
  async removeFeature(client: PoolClient, planId: string, code: string): Promise<number> {
    const r = await client.query(`DELETE FROM plan_features WHERE plan_id=$1 AND feature_code=$2`, [planId, code]);
    return r.rowCount ?? 0;
  }
  async upsertLimit(client: PoolClient, planId: string, code: string, value: bigint): Promise<void> {
    await client.query(
      `INSERT INTO plan_limits (plan_id, limit_code, limit_value) VALUES ($1,$2,$3)
       ON CONFLICT (plan_id, limit_code) DO UPDATE SET limit_value=EXCLUDED.limit_value`,
      [planId, code, value.toString()]);
  }
  async removeLimit(client: PoolClient, planId: string, code: string): Promise<number> {
    const r = await client.query(`DELETE FROM plan_limits WHERE plan_id=$1 AND limit_code=$2`, [planId, code]);
    return r.rowCount ?? 0;
  }

  /* ---------------- plan_changes (append-only history) ---------------- */
  async insertChange(client: PoolClient, c: { planId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO plan_changes (plan_id, action, old_value, new_value, reason, actor_user_id) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
      [c.planId, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }
  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.planId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'plan_id=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, plan_id, action, old_value, new_value, reason, actor_user_id, created_at FROM plan_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, planId: x.plan_id, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
