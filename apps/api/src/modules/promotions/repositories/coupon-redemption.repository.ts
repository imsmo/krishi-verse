// modules/promotions/repositories/coupon-redemption.repository.ts
// APPEND-ONLY redemption ledger (DB revokes UPDATE/DELETE on coupon_redemptions from kv_app). tenant_id
// in EVERY query (Law 1) + RLS. UNIQUE(coupon_id, order_id) makes redemption idempotent per order.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CouponRedemption } from '../domain/coupon-redemption.entity';

@Injectable()
export class CouponRedemptionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Returns false if a redemption already exists for (coupon, order) — idempotent per order. */
  async insert(tx: TxContext, r: CouponRedemption): Promise<boolean> {
    const v = r.props;
    const res = await tx.query(
      `INSERT INTO coupon_redemptions (id, coupon_id, tenant_id, user_id, order_id, amount_minor)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (coupon_id, order_id) DO NOTHING`,
      [v.id, v.couponId, v.tenantId, v.userId, v.orderId, v.amountMinor.toString()]);
    return (res.rowCount ?? 0) > 0;
  }
  /** How many times this user has redeemed this coupon (enforces per_user_limit). Counted in-tx. */
  async countForUser(tx: TxContext, tenantId: string, couponId: string, userId: string): Promise<number> {
    const r = await tx.query(`SELECT count(*)::int n FROM coupon_redemptions WHERE tenant_id=$1 AND coupon_id=$2 AND user_id=$3`, [tenantId, couponId, userId]);
    return r.rows[0].n as number;
  }
  async listForUser(tenantId: string, userId: string, q: { cursor?: { c: string; id: string }; limit: number }): Promise<Array<{ id: string; couponId: string; orderId: string; amountMinor: string; createdAt: Date }>> {
    const params: unknown[] = [tenantId, userId];
    let where = `tenant_id=$1 AND user_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT id, coupon_id, order_id, amount_minor, created_at FROM coupon_redemptions WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x) => ({ id: x.id, couponId: x.coupon_id, orderId: x.order_id, amountMinor: String(x.amount_minor), createdAt: x.created_at }));
  }
}
