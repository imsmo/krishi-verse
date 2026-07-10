// modules/orders/read-models/order-tracking.read-model.ts
// CQRS read path (Law 12) for the buyer/seller order-TRACKING view (mobile screen 131, order-detail 23).
// Party-authorised: the caller must be the order's buyer or seller (or a moderator) — reuses
// OrderRepository.getVisible (not-yours ⇒ not-found, no enumeration). Returns the REAL stamped timelines:
//   • order_events   — every order-status transition (from→to) with its timestamp + note (per-step times).
//   • shipment (+ shipment_events) — the delivery status timeline with each transition's timestamp and, when
//     a rider has posted one, a lat/lng ping (logistics tracking feed).
// This is a read-only cross-table projection over the SAME DB (like DeliveryZoneRepository already used here) —
// tenant_id in every query (Law 1) + RLS via the replica GUC is the net. No ETA field exists in any contract,
// so the caller (screen) shows ETA as "—" rather than a fabricated one (§13). lat/lng are geo coordinates (not
// money) so plain numbers are fine (Law 2 governs money only). Reads on the replica; degrade-never-die upstream.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { OrderNotFoundError } from '../domain/orders.errors';
import { OrderRepository } from '../repositories/order.repository';

export interface OrderActorRef { userId: string; canModerate: boolean; }
export interface OrderEventPoint { fromStatus: string | null; toStatus: string; at: string; note: string | null; }
export interface ShipmentEventPoint { status: string; at: string; lat: number | null; lng: number | null; note: string | null; }
export interface TrackingShipment {
  id: string; status: string; riderUserId: string | null; awbNo: string | null;
  scheduledPickupAt: string | null; pickedUpAt: string | null; deliveredAt: string | null;
}
export interface OrderTracking {
  orderId: string; status: string; createdAt: string; completedAt: string | null;
  orderEvents: OrderEventPoint[];
  shipment: TrackingShipment | null;
  shipmentEvents: ShipmentEventPoint[];
}

const num = (v: unknown): number | null => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

@Injectable()
export class OrderTrackingReadModel {
  constructor(
    @Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider,
    private readonly orders: OrderRepository,
  ) {}

  async tracking(tenantId: string, actor: OrderActorRef, orderId: string): Promise<OrderTracking> {
    // 1) party authorisation — buyer/seller/moderator only (not-yours ⇒ not-found).
    const order = await this.orders.getVisible(tenantId, orderId, actor.userId, actor.canModerate);
    if (!order) throw new OrderNotFoundError(orderId);
    const o = order.toProps();
    const db = this.replica.forTenant(tenantId);

    // 2) order-status transition timeline (real per-step timestamps). Bounded (few rows/order).
    const oe = await db.query(
      `SELECT from_status, to_status, note, created_at FROM order_events
         WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at ASC`, [tenantId, orderId]);
    const orderEvents: OrderEventPoint[] = oe.rows.map((r: any) => ({ fromStatus: r.from_status ?? null, toStatus: r.to_status, at: iso(r.created_at), note: r.note ?? null }));

    // 3) the order's shipment (latest) + its status/location timeline.
    const sh = await db.query(
      `SELECT id, status, rider_user_id, awb_no, scheduled_pickup_at, picked_up_at, delivered_at
         FROM shipments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at DESC LIMIT 1`, [tenantId, orderId]);
    let shipment: TrackingShipment | null = null;
    let shipmentEvents: ShipmentEventPoint[] = [];
    if (sh.rows[0]) {
      const s = sh.rows[0];
      shipment = { id: s.id, status: s.status, riderUserId: s.rider_user_id ?? null, awbNo: s.awb_no ?? null,
        scheduledPickupAt: s.scheduled_pickup_at ? iso(s.scheduled_pickup_at) : null,
        pickedUpAt: s.picked_up_at ? iso(s.picked_up_at) : null, deliveredAt: s.delivered_at ? iso(s.delivered_at) : null };
      const se = await db.query(
        `SELECT status, lat, lng, note, created_at FROM shipment_events
           WHERE tenant_id=$1 AND shipment_id=$2 ORDER BY created_at ASC`, [tenantId, shipment.id]);
      shipmentEvents = se.rows.map((r: any) => ({ status: r.status, at: iso(r.created_at), lat: num(r.lat), lng: num(r.lng), note: r.note ?? null }));
    }

    return { orderId, status: o.status, createdAt: iso(o.createdAt), completedAt: o.completedAt ? iso(o.completedAt) : null, orderEvents, shipment, shipmentEvents };
  }
}
