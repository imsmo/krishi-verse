// modules/orders/services/checkout-group.service.ts
// Read side of checkout groups (one payment spanning many sub-orders of a multi-seller cart). The group
// is WRITTEN by CheckoutService inside the cart→orders tx (via CheckoutGroupRepository.insert); this
// service exposes the buyer/moderator views. Visibility: the buyer who owns the group, or a moderator —
// a non-owner gets 404 (no enumeration / IDOR). Reads on the replica (CQRS); bounded + keyset-paginated.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { CheckoutGroupRepository } from '../repositories/checkout-group.repository';
import { OrderNotFoundError } from '../domain/orders.errors';

export interface OrdersActor { userId: string; canModerate: boolean; }
const enc = (s: string) => Buffer.from(s).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

@Injectable()
export class CheckoutGroupService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly groups: CheckoutGroupRepository) {}

  /** A checkout group + its sub-orders, visible to the owning buyer or a moderator (else 404). */
  async getGroup(tenantId: string, actor: OrdersActor, groupId: string) {
    return timed(this.metrics, 'orders.checkout_group_get', { tenant: tenantId }, async () => {
      const g = await this.groups.getById(tenantId, groupId);
      if (!g || (!actor.canModerate && g.buyerUserId !== actor.userId)) throw new OrderNotFoundError(groupId);   // 404, not 403
      const orders = await this.groups.ordersInGroup(tenantId, groupId);
      return {
        id: g.id, buyerUserId: g.buyerUserId, totalMinor: g.totalMinor.toString(), currencyCode: g.currencyCode, createdAt: g.createdAt,
        orders: orders.map((o) => ({ id: o.id, orderNo: o.orderNo, sellerUserId: o.sellerUserId, status: o.status, totalMinor: o.totalMinor, createdAt: o.createdAt })),
      };
    });
  }

  /** The caller's own checkout groups (buyer-scoped), keyset-paginated. */
  async listForBuyer(tenantId: string, userId: string, q: { cursor?: string; limit: number }) {
    let cursor: { c: string; id: string } | undefined;
    if (q.cursor) { try { cursor = JSON.parse(dec(q.cursor)); } catch { /* first page */ } }
    const rows = await this.groups.listForBuyer(tenantId, userId, { cursor, limit: q.limit + 1 });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const items = page.map((g) => ({ id: g.id, totalMinor: g.totalMinor.toString(), currencyCode: g.currencyCode, createdAt: g.createdAt }));
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? enc(JSON.stringify({ c: new Date(last.createdAt).toISOString(), id: last.id })) : null;
    return { items, nextCursor };
  }
}
