// modules/requirements/repositories/requirement-response.repository.ts
// All SQL for the requirement_responses (seller quotes) aggregate. tenant_id in EVERY query (Law 1) +
// RLS. UNIQUE (requirement_id, seller_user_id) — one quote per seller per requirement (insert uses
// ON CONFLICT DO NOTHING so a duplicate is detected, not a 500). No version column → FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { RequirementResponse } from '../domain/requirement-response.entity';
import { ResponseStatus } from '../domain/requirement-response.state';

const COLS = `id, requirement_id, tenant_id, seller_user_id, listing_id, quoted_price_minor, quantity, valid_until, message, status, created_at`;
function toDomain(r: any): RequirementResponse {
  return RequirementResponse.rehydrate({
    id: r.id, requirementId: r.requirement_id, tenantId: r.tenant_id, sellerUserId: r.seller_user_id, listingId: r.listing_id,
    quotedPriceMinor: BigInt(r.quoted_price_minor), quantity: String(r.quantity), validUntil: r.valid_until, message: r.message,
    status: r.status as ResponseStatus, createdAt: r.created_at,
  });
}
export interface RespListQuery { status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class RequirementResponseRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Insert a quote. Returns false on a (requirement, seller) uniqueness conflict (already quoted). */
  async insert(tx: TxContext, r: RequirementResponse): Promise<boolean> {
    const p = r.toProps();
    const res = await tx.query(
      `INSERT INTO requirement_responses (id, requirement_id, tenant_id, seller_user_id, listing_id, quoted_price_minor, quantity, valid_until, message, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (requirement_id, seller_user_id) DO NOTHING`,
      [p.id, p.requirementId, p.tenantId, p.sellerUserId, p.listingId, p.quotedPriceMinor.toString(), p.quantity, p.validUntil, p.message, p.status]);
    return (res.rowCount ?? 0) > 0;
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<RequirementResponse | null> {
    const r = await tx.query(`SELECT ${COLS} FROM requirement_responses WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<RequirementResponse | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM requirement_responses WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, r: RequirementResponse): Promise<void> {
    const p = r.toProps();
    await tx.query(`UPDATE requirement_responses SET status=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [p.id, p.tenantId, p.status]);
  }

  /** Quotes on a requirement (buyer view, or a seller's own). Keyset — never OFFSET. */
  async listForRequirement(tenantId: string, requirementId: string, q: RespListQuery): Promise<RequirementResponse[]> {
    const params: unknown[] = [tenantId, requirementId];
    let where = `tenant_id=$1 AND requirement_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM requirement_responses WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** Worker finder (cross-tenant; kv_relay). Bounded + SKIP LOCKED; live quotes past valid_until. */
  async findDueToExpire(tx: TxContext, now: Date, limit: number): Promise<RequirementResponse[]> {
    const r = await tx.query(
      `SELECT ${COLS} FROM requirement_responses WHERE status IN ('submitted','shortlisted') AND valid_until IS NOT NULL AND valid_until < $1
        ORDER BY valid_until LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }
}
