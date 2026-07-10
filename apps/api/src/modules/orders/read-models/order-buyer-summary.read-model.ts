// modules/orders/read-models/order-buyer-summary.read-model.ts
// CQRS read (Law 12) — the BUYER trust summary the SELLER sees when deciding to accept/reject a new order
// (mobile screen 57). SELLER-scoped: the caller must be the order's seller (or a moderator); a buyer asking for
// their own order gets not-found (no enumeration). Returns only coarse, non-PII trust signals the platform can
// stand behind: how many orders the buyer has placed in this tenant (total + completed), and the buyer's business
// type IF they have a VERIFIED business-KYC profile (a category the buyer themselves submitted — never a raw
// GSTIN/PAN, DPDP §4). §13: distance / years-on-platform / payment-rate have no honest contract → NOT returned
// (the screen shows "—"). tenant_id in every query + RLS via the replica GUC. Read-only cross-table projection.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { OrderNotFoundError } from '../domain/orders.errors';
import { OrderRepository } from '../repositories/order.repository';

export interface OrderActorRef { userId: string; canModerate: boolean; }
export interface OrderBuyerSummary {
  ordersAsBuyer: number;
  completedAsBuyer: number;
  businessType: string | null;   // verified business-KYC type, else null
}

@Injectable()
export class OrderBuyerSummaryReadModel {
  constructor(
    @Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider,
    private readonly orders: OrderRepository,
  ) {}

  async forOrder(tenantId: string, actor: OrderActorRef, orderId: string): Promise<OrderBuyerSummary> {
    const order = await this.orders.getVisible(tenantId, orderId, actor.userId, actor.canModerate);
    if (!order) throw new OrderNotFoundError(orderId);
    const o = order.toProps();
    // seller-only aid — a buyer viewing their own order gets not-found (no enumeration of others' trust data).
    if (!actor.canModerate && o.sellerUserId !== actor.userId) throw new OrderNotFoundError(orderId);

    const counts = await this.orders.buyerOrderCounts(tenantId, o.buyerUserId);
    const bt = await this.replica.forTenant(tenantId).query(
      `SELECT business_type FROM business_kyc_profiles
         WHERE tenant_id=$1 AND user_id=$2 AND status='verified' AND deleted_at IS NULL LIMIT 1`,
      [tenantId, o.buyerUserId]);
    return { ordersAsBuyer: counts.ordersAsBuyer, completedAsBuyer: counts.completedAsBuyer, businessType: bt.rows[0]?.business_type ?? null };
  }
}
