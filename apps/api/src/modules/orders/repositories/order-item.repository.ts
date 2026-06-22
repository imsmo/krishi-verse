// modules/orders/repositories/order-item.repository.ts
// order_items is PARTITIONED by created_at (PK includes created_at). Like order.repository, every query
// derives the parent partition window from the order's v7 id via uuid_v7_time() so PostgreSQL prunes to
// ONE partition (Law 8) instead of scanning all. tenant_id in EVERY query (Law 1) + RLS. Reads on the
// replica; the only mutation is recording DELIVERED quantity (partial fulfilment) in the caller's tx.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

const PRUNE = `order_created_at >= uuid_v7_time($2) - interval '5 seconds' AND order_created_at < uuid_v7_time($2) + interval '5 seconds'`;

export interface OrderItemView {
  listingId: string; productId: string; titleSnapshot: string; quantity: string; deliveredQuantity: string | null;
  unitCode: string; unitPriceMinor: string; lineTotalMinor: string; gstRatePct: number | null; batchId: string | null;
}
function toView(x: any): OrderItemView {
  return { listingId: x.listing_id, productId: x.product_id, titleSnapshot: x.title_snapshot, quantity: String(x.quantity),
    deliveredQuantity: x.delivered_quantity == null ? null : String(x.delivered_quantity), unitCode: x.unit_code,
    unitPriceMinor: String(x.unit_price_minor), lineTotalMinor: String(x.line_total_minor), gstRatePct: x.gst_rate_pct, batchId: x.batch_id };
}

@Injectable()
export class OrderItemRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** A bounded list of an order's frozen line items (replica, partition-pruned). */
  async listByOrder(tenantId: string, orderId: string, limit = 200): Promise<OrderItemView[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT listing_id, product_id, title_snapshot, quantity, delivered_quantity, unit_code, unit_price_minor, line_total_minor, gst_rate_pct, batch_id
         FROM order_items WHERE tenant_id=$1 AND order_id=$2 AND ${PRUNE} ORDER BY id LIMIT ${Math.min(Math.max(limit, 1), 500)}`,
      [tenantId, orderId]);
    return r.rows.map(toView);
  }

  /** Lock an order's lines in the caller's tx (partition-pruned) — used before recording delivery. */
  async forUpdate(tx: TxContext, tenantId: string, orderId: string): Promise<Array<{ id: string; listingId: string; quantity: string; deliveredQuantity: string | null }>> {
    const r = await tx.query(
      `SELECT id, listing_id, quantity, delivered_quantity FROM order_items WHERE tenant_id=$1 AND order_id=$2 AND ${PRUNE} FOR UPDATE`,
      [tenantId, orderId]);
    return r.rows.map((x) => ({ id: x.id, listingId: x.listing_id, quantity: String(x.quantity), deliveredQuantity: x.delivered_quantity == null ? null : String(x.delivered_quantity) }));
  }

  /** Record the delivered quantity for one line (partial fulfilment, PRD §9.6). Returns rows affected. */
  async recordDelivered(tx: TxContext, tenantId: string, orderId: string, listingId: string, deliveredQuantity: number): Promise<number> {
    const r = await tx.query(
      `UPDATE order_items SET delivered_quantity=$4 WHERE tenant_id=$1 AND order_id=$2 AND ${PRUNE} AND listing_id=$3`,
      [tenantId, orderId, listingId, deliveredQuantity]);
    return r.rowCount ?? 0;
  }
}
