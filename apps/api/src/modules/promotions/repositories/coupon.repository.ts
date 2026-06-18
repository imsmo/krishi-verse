// modules/promotions/repositories/coupon.repository.ts
// All SQL for coupons. tenant_id in EVERY query (Law 1) + RLS. No version column → the redeem path
// locks the coupon row FOR UPDATE so the global cap (max_uses) can't be oversold. UNIQUE(tenant_id, code).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Coupon } from '../domain/coupon.entity';

const COLS = `id, tenant_id, promotion_id, code, max_uses, uses, per_user_limit, deleted_at, created_at`;
function toDomain(r: any): Coupon {
  return Coupon.rehydrate({ id: r.id, tenantId: r.tenant_id, promotionId: r.promotion_id, code: r.code, maxUses: r.max_uses, uses: r.uses, perUserLimit: r.per_user_limit, deletedAt: r.deleted_at, createdAt: r.created_at });
}

@Injectable()
export class CouponRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Returns false on a (tenant, code) uniqueness conflict (code already exists). */
  async insert(tx: TxContext, c: Coupon): Promise<boolean> {
    const v = c.toProps();
    const r = await tx.query(
      `INSERT INTO coupons (id, tenant_id, promotion_id, code, max_uses, uses, per_user_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id, code) DO NOTHING`,
      [v.id, v.tenantId, v.promotionId, v.code, v.maxUses, v.uses, v.perUserLimit]);
    return (r.rowCount ?? 0) > 0;
  }
  /** Lock the live coupon by code for redemption (excludes soft-deleted). */
  async getByCodeForUpdate(tx: TxContext, tenantId: string, code: string): Promise<Coupon | null> {
    const r = await tx.query(`SELECT ${COLS} FROM coupons WHERE tenant_id=$1 AND code=$2 AND deleted_at IS NULL FOR UPDATE`, [tenantId, code.toUpperCase()]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getByCode(tenantId: string, code: string): Promise<Coupon | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM coupons WHERE tenant_id=$1 AND code=$2 AND deleted_at IS NULL`, [tenantId, code.toUpperCase()]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<Coupon | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM coupons WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Persist the consumed use within the redeem tx. */
  async updateUses(tx: TxContext, c: Coupon): Promise<void> {
    const v = c.toProps();
    await tx.query(`UPDATE coupons SET uses=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [v.id, v.tenantId, v.uses]);
  }
  async softDelete(tx: TxContext, tenantId: string, id: string): Promise<void> {
    await tx.query(`UPDATE coupons SET deleted_at=now(), updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
  }
  async listForPromotion(tenantId: string, promotionId: string, q: { cursor?: { c: string; id: string }; limit: number }): Promise<Coupon[]> {
    const params: unknown[] = [tenantId, promotionId];
    let where = `tenant_id=$1 AND promotion_id=$2 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM coupons WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
