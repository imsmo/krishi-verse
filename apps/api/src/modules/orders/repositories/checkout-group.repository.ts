// modules/orders/repositories/checkout-group.repository.ts
// SQL for checkout_groups (one payment spanning many sub-orders of a multi-seller cart). tenant_id in
// EVERY query (Law 1) + RLS. Writes run in the caller's tx (checkout opens the group atomically with the
// orders); reads on the replica, keyset-paginated + bounded. The sub-orders of a group are read from the
// orders table by checkout_group_id (orders is partitioned → bounded by a recent-window guard).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CheckoutGroup } from '../domain/checkout-group.entity';

export interface CheckoutGroupRow { id: string; tenantId: string; buyerUserId: string; totalMinor: bigint; currencyCode: string; createdAt: Date }
export interface GroupOrderRow { id: string; orderNo: string; sellerUserId: string; status: string; totalMinor: string; createdAt: Date }

@Injectable()
export class CheckoutGroupRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Open a checkout group in the caller's tx (the writer is CheckoutService, atomically with the orders). */
  async insert(tx: TxContext, g: CheckoutGroup): Promise<void> {
    const p = g.props;
    await tx.query(
      `INSERT INTO checkout_groups (id, tenant_id, buyer_user_id, total_minor, currency_code) VALUES ($1,$2,$3,$4,$5)`,
      [p.id, p.tenantId, p.buyerUserId, p.totalMinor.toString(), p.currencyCode]);
  }

  async getById(tenantId: string, id: string): Promise<CheckoutGroupRow | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, tenant_id, buyer_user_id, total_minor, currency_code, created_at FROM checkout_groups WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    const x = r.rows[0];
    return x ? { id: x.id, tenantId: x.tenant_id, buyerUserId: x.buyer_user_id, totalMinor: BigInt(x.total_minor), currencyCode: x.currency_code, createdAt: x.created_at } : null;
  }

  /** The sub-orders that make up the group (bounded recent-partition scan; a group is small). */
  async ordersInGroup(tenantId: string, groupId: string): Promise<GroupOrderRow[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, order_no, seller_user_id, status, total_minor, created_at FROM orders
        WHERE tenant_id=$1 AND checkout_group_id=$2 AND created_at > now() - interval '180 days'
        ORDER BY created_at ASC, id ASC LIMIT 200`, [tenantId, groupId]);
    return r.rows.map((x) => ({ id: x.id, orderNo: x.order_no, sellerUserId: x.seller_user_id, status: x.status, totalMinor: String(x.total_minor), createdAt: x.created_at }));
  }

  async listForBuyer(tenantId: string, buyerUserId: string, opts: { cursor?: { c: string; id: string }; limit: number }): Promise<CheckoutGroupRow[]> {
    const params: unknown[] = [tenantId, buyerUserId];
    let where = `tenant_id=$1 AND buyer_user_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.cursor) { const cc = p(opts.cursor.c), ci = p(opts.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(opts.limit);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, tenant_id, buyer_user_id, total_minor, currency_code, created_at FROM checkout_groups WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x) => ({ id: x.id, tenantId: x.tenant_id, buyerUserId: x.buyer_user_id, totalMinor: BigInt(x.total_minor), currencyCode: x.currency_code, createdAt: x.created_at }));
  }
}
