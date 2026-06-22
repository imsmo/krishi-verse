// modules/promotions/repositories/promotion.repository.ts
// All SQL for the promotions aggregate. tenant_id in EVERY query (Law 1) + RLS. No version column
// (add_std_columns) → budget mutations lock the row with SELECT … FOR UPDATE. Reads on the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Promotion, parsePromoRules } from '../domain/promotion.entity';

const COLS = `id, tenant_id, promo_type, default_name, rules, budget_minor, spent_minor, starts_at, ends_at, is_active, created_at`;
const big = (v: any) => (v == null ? null : BigInt(v));
function toDomain(r: any): Promotion {
  return Promotion.rehydrate({
    id: r.id, tenantId: r.tenant_id, promoType: r.promo_type, defaultName: r.default_name, rules: parsePromoRules(r.rules),
    budgetMinor: big(r.budget_minor), spentMinor: BigInt(r.spent_minor), startsAt: r.starts_at, endsAt: r.ends_at, isActive: r.is_active, createdAt: r.created_at,
  });
}
export interface PromoListQuery { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class PromotionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, p: Promotion): Promise<void> {
    const v = p.toProps();
    await tx.query(
      `INSERT INTO promotions (id, tenant_id, promo_type, default_name, rules, budget_minor, spent_minor, starts_at, ends_at, is_active)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)`,
      [v.id, v.tenantId, v.promoType, v.defaultName, JSON.stringify(rulesToJson(v.rules)), v.budgetMinor?.toString() ?? null, v.spentMinor.toString(), v.startsAt, v.endsAt, v.isActive]);
  }
  /** Lock for a budget/active mutation (serializes concurrent redemptions sharing a budget). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Promotion | null> {
    const r = await tx.query(`SELECT ${COLS} FROM promotions WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<Promotion | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM promotions WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** No version column → unconditional update within the FOR UPDATE-locked tx (spend + active toggle). */
  async update(tx: TxContext, p: Promotion): Promise<void> {
    const v = p.toProps();
    await tx.query(`UPDATE promotions SET spent_minor=$3, is_active=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [v.id, v.tenantId, v.spentMinor.toString(), v.isActive]);
  }
  async listFor(tenantId: string, q: PromoListQuery): Promise<Promotion[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1`;
    const p = (val: unknown) => { params.push(val); return `$${params.length}`; };
    if (q.activeOnly) where += ` AND is_active=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM promotions WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  // ---- worker-job finders (cross-tenant; kv_relay, BYPASSRLS). Bounded + SKIP LOCKED. ----
  /** promo-budget-watch: ACTIVE promotions that have hit/exceeded their budget. */
  async findBudgetExhausted(tx: TxContext, limit: number): Promise<Array<{ id: string; tenantId: string }>> {
    const r = await tx.query(
      `SELECT id, tenant_id FROM promotions
        WHERE is_active = true AND budget_minor IS NOT NULL AND spent_minor >= budget_minor
        ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
    return r.rows.map((x: any) => ({ id: x.id, tenantId: x.tenant_id }));
  }
  /** festival-campaign-scheduler: 'festival' promotions whose is_active disagrees with their
   *  [starts_at, ends_at] window right now (need to be opened or closed). */
  async findFestivalToggles(tx: TxContext, now: Date, limit: number): Promise<Array<{ id: string; tenantId: string }>> {
    const r = await tx.query(
      `SELECT id, tenant_id FROM promotions
        WHERE promo_type = 'festival'
          AND is_active <> ($1::timestamptz BETWEEN starts_at AND ends_at)
        ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map((x: any) => ({ id: x.id, tenantId: x.tenant_id }));
  }
}

/** Serialize the typed rules back to the stored jsonb shape (minor amounts as strings). */
function rulesToJson(r: ReturnType<Promotion['toProps']>['rules']): Record<string, unknown> {
  return { discountType: r.discountType, percentOff: r.percentOff ?? undefined, amountOffMinor: r.amountOffMinor?.toString(),
    minOrderMinor: r.minOrderMinor?.toString(), maxDiscountMinor: r.maxDiscountMinor?.toString() };
}
