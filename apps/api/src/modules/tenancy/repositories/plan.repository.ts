// modules/tenancy/repositories/plan.repository.ts
// SQL for the GLOBAL plan catalogue (plans + plan_limits) — no tenant_id (platform config; RLS does not
// apply). Plan mutations are platform-admin only (Law 11). No optimistic-lock column → admin mutations
// lock the row FOR UPDATE. Limits are loaded in ONE batched query (no N+1). Reads on the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Plan } from '../domain/plan.entity';

const COLS = `id, code, version, default_name, country_code, currency_code, monthly_price_minor, annual_price_minor, setup_fee_minor, is_public, is_active, created_at`;
function rowToProps(r: any, limits: Record<string, bigint>) {
  return { id: r.id, code: r.code, version: r.version, defaultName: r.default_name, countryCode: r.country_code, currencyCode: r.currency_code,
    monthlyPriceMinor: BigInt(r.monthly_price_minor), annualPriceMinor: BigInt(r.annual_price_minor), setupFeeMinor: BigInt(r.setup_fee_minor),
    isPublic: r.is_public, isActive: r.is_active, limits, createdAt: r.created_at };
}

@Injectable()
export class PlanRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Insert plan + its plan_limits. Returns false on (code, version, country) conflict. */
  async insert(tx: TxContext, plan: Plan): Promise<boolean> {
    const p = plan.toProps();
    const r = await tx.query(
      `INSERT INTO plans (id, code, version, default_name, country_code, currency_code, monthly_price_minor, annual_price_minor, setup_fee_minor, is_public, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (code, version, country_code) DO NOTHING`,
      [p.id, p.code, p.version, p.defaultName, p.countryCode, p.currencyCode, p.monthlyPriceMinor.toString(), p.annualPriceMinor.toString(), p.setupFeeMinor.toString(), p.isPublic, p.isActive]);
    if ((r.rowCount ?? 0) === 0) return false;
    for (const [code, value] of Object.entries(p.limits)) {
      await tx.query(`INSERT INTO plan_limits (plan_id, limit_code, limit_value) VALUES ($1,$2,$3) ON CONFLICT (plan_id, limit_code) DO UPDATE SET limit_value=EXCLUDED.limit_value`, [p.id, code, value.toString()]);
    }
    return true;
  }

  async getForUpdate(tx: TxContext, id: string): Promise<Plan | null> {
    const r = await tx.query(`SELECT ${COLS} FROM plans WHERE id=$1 FOR UPDATE`, [id]);
    if (!r.rows[0]) return null;
    const lim = await tx.query(`SELECT limit_code, limit_value FROM plan_limits WHERE plan_id=$1`, [id]);
    return Plan.rehydrate(rowToProps(r.rows[0], mapLimits(lim.rows)));
  }
  async getById(tenantId: string, id: string): Promise<Plan | null> {
    const repl = this.replica.forTenant(tenantId);
    const r = await repl.query(`SELECT ${COLS} FROM plans WHERE id=$1`, [id]);
    if (!r.rows[0]) return null;
    const lim = await repl.query(`SELECT limit_code, limit_value FROM plan_limits WHERE plan_id=$1`, [id]);
    return Plan.rehydrate(rowToProps(r.rows[0], mapLimits(lim.rows)));
  }
  /** Plans (public-only for non-admins). Keyset (created_at DESC, id DESC); limits batched (no N+1). */
  async listFor(tenantId: string, q: { publicOnly?: boolean; cursor?: { c: string; id: string }; limit: number }): Promise<Plan[]> {
    const repl = this.replica.forTenant(tenantId);
    const params: unknown[] = [];
    let where = `1=1`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.publicOnly) where += ` AND is_public=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await repl.query(`SELECT ${COLS} FROM plans WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    if (r.rows.length === 0) return [];
    const ids = r.rows.map((x) => x.id);
    const lim = await repl.query(`SELECT plan_id, limit_code, limit_value FROM plan_limits WHERE plan_id = ANY($1::uuid[])`, [ids]);
    const byPlan: Record<string, Record<string, bigint>> = {};
    for (const l of lim.rows) (byPlan[l.plan_id] ??= {})[l.limit_code] = BigInt(l.limit_value);
    return r.rows.map((x) => Plan.rehydrate(rowToProps(x, byPlan[x.id] ?? {})));
  }
  async update(tx: TxContext, plan: Plan): Promise<void> {
    const p = plan.toProps();
    await tx.query(`UPDATE plans SET is_active=$2, updated_at=now() WHERE id=$1`, [p.id, p.isActive]);
  }
}

function mapLimits(rows: any[]): Record<string, bigint> { const m: Record<string, bigint> = {}; for (const r of rows) m[r.limit_code] = BigInt(r.limit_value); return m; }
