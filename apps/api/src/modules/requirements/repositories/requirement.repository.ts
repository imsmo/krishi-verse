// modules/requirements/repositories/requirement.repository.ts
// All SQL for the requirements aggregate. tenant_id in EVERY query (Law 1) + RLS (auto-applied by
// migration 0014 — requirements predates it). NO version column (add_std_columns) → mutations LOCK
// the row with SELECT … FOR UPDATE. Reads on the replica; the expiry job uses SKIP LOCKED.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Requirement } from '../domain/requirement.entity';
import { RequirementStatus } from '../domain/requirement.state';

const COLS = `id, tenant_id, buyer_user_id, product_id, category_id, title, quantity, unit_code,
  budget_min_minor, budget_max_minor, currency_code, need_by, delivery_pincode, status, is_urgent, created_at`;
const big = (v: any) => (v == null ? null : BigInt(v));
function toDomain(r: any): Requirement {
  return Requirement.rehydrate({
    id: r.id, tenantId: r.tenant_id, buyerUserId: r.buyer_user_id, productId: r.product_id, categoryId: r.category_id,
    title: r.title, quantity: String(r.quantity), unitCode: r.unit_code, budgetMinMinor: big(r.budget_min_minor),
    budgetMaxMinor: big(r.budget_max_minor), currencyCode: r.currency_code, needBy: r.need_by, deliveryPincode: r.delivery_pincode,
    status: r.status as RequirementStatus, isUrgent: r.is_urgent, createdAt: r.created_at,
  });
}
export interface ReqListQuery { status?: string; categoryId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class RequirementRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, r: Requirement): Promise<void> {
    const p = r.toProps();
    await tx.query(
      `INSERT INTO requirements (id, tenant_id, buyer_user_id, product_id, category_id, title, quantity, unit_code,
         budget_min_minor, budget_max_minor, currency_code, need_by, delivery_pincode, status, is_urgent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [p.id, p.tenantId, p.buyerUserId, p.productId, p.categoryId, p.title, p.quantity, p.unitCode,
       p.budgetMinMinor?.toString() ?? null, p.budgetMaxMinor?.toString() ?? null, p.currencyCode,
       p.needBy, p.deliveryPincode, p.status, p.isUrgent]);
  }

  /** Lock the requirement row for a status mutation (serializes concurrent shortlist/accept/close). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Requirement | null> {
    const r = await tx.query(`SELECT ${COLS} FROM requirements WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<Requirement | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM requirements WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** No version column → unconditional update within the FOR UPDATE-locked tx. Persists status + the
   *  editable fields (buyer edit of an OPEN requirement). */
  async update(tx: TxContext, r: Requirement): Promise<void> {
    const p = r.toProps();
    await tx.query(
      `UPDATE requirements SET status=$3, title=$4, quantity=$5, unit_code=$6, product_id=$7, category_id=$8,
         budget_min_minor=$9, budget_max_minor=$10, need_by=$11, delivery_pincode=$12, is_urgent=$13, updated_at=now()
        WHERE id=$1 AND tenant_id=$2`,
      [p.id, p.tenantId, p.status, p.title, p.quantity, p.unitCode, p.productId, p.categoryId,
       p.budgetMinMinor?.toString() ?? null, p.budgetMaxMinor?.toString() ?? null, p.needBy, p.deliveryPincode, p.isUrgent]);
  }

  /** Browse OPEN requirements (sellers). Keyset (created_at DESC, id DESC) — never OFFSET. */
  async listOpen(tenantId: string, q: ReqListQuery): Promise<Requirement[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND status IN ('open','partially_matched')`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.categoryId) where += ` AND category_id=${p(q.categoryId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM requirements WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** The buyer's own requirements. */
  async listForBuyer(tenantId: string, buyerUserId: string, q: ReqListQuery): Promise<Requirement[]> {
    const params: unknown[] = [tenantId, buyerUserId];
    let where = `tenant_id=$1 AND buyer_user_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM requirements WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** Worker finder (cross-tenant; kv_relay). Bounded + SKIP LOCKED; open/partially_matched past need_by. */
  async findDueToExpire(tx: TxContext, now: Date, limit: number): Promise<Requirement[]> {
    const r = await tx.query(
      `SELECT ${COLS} FROM requirements WHERE status IN ('open','partially_matched') AND need_by IS NOT NULL AND need_by < $1::date
        ORDER BY need_by LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }

  /** WITHIN-TENANT match finder for the listing-published handler (runs in the relay tx, tenant_id set).
   *  OPEN requirements whose product or category equals the freshly-published listing's, EXCLUDING the
   *  buyer who is also the listing's seller (never nudge someone about their own listing). Bounded
   *  (LIMIT) to cap write-amplification when a hot category matches many requirements (§4/§5). */
  async findOpenMatching(tx: TxContext, tenantId: string, m: { productId?: string | null; categoryId?: string | null; excludeUserId?: string }, limit: number): Promise<Array<{ id: string; buyerUserId: string }>> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const ors: string[] = [];
    if (m.productId) ors.push(`product_id=${p(m.productId)}`);
    if (m.categoryId) ors.push(`category_id=${p(m.categoryId)}`);
    if (ors.length === 0) return [];
    let where = `tenant_id=$1 AND status IN ('open','partially_matched') AND (${ors.join(' OR ')})`;
    if (m.excludeUserId) where += ` AND buyer_user_id <> ${p(m.excludeUserId)}`;
    const lp = p(limit);
    const r = await tx.query(`SELECT id, buyer_user_id FROM requirements WHERE ${where} ORDER BY created_at DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, buyerUserId: x.buyer_user_id }));
  }

  /** Worker finder (cross-tenant; kv_relay) for the match-notifications reminder: OPEN requirements
   *  approaching need_by that haven't been reminded yet. Bounded + SKIP LOCKED. */
  async findDueForReminder(tx: TxContext, now: Date, horizon: Date, limit: number): Promise<Array<{ id: string; tenantId: string; buyerUserId: string }>> {
    const r = await tx.query(
      `SELECT id, tenant_id, buyer_user_id FROM requirements
        WHERE status IN ('open','partially_matched') AND reminded_at IS NULL
          AND need_by IS NOT NULL AND need_by >= $1::date AND need_by <= $2::date
        ORDER BY need_by LIMIT $3 FOR UPDATE SKIP LOCKED`, [now, horizon, limit]);
    return r.rows.map((x: any) => ({ id: x.id, tenantId: x.tenant_id, buyerUserId: x.buyer_user_id }));
  }
  /** Stamp the rows the reminder job just nudged (idempotency marker). */
  async markReminded(tx: TxContext, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await tx.query(`UPDATE requirements SET reminded_at=now() WHERE id = ANY($1::uuid[])`, [ids]);
  }
}
