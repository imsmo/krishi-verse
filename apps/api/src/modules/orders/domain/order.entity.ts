// modules/orders/domain/order.entity.ts
// Order aggregate root. Pure domain: money in bigint minor units, status transitions ONLY via
// the state machine (Law 5), optimistic-locked by `version`. Created in 'created' (COD-style)
// or 'payment_pending' when online payment is required (the money step is owned by payments).
import { OrderStatus, assertTransition, isCancellable } from './order.state';
import { OrderItem } from './order-item.entity';
import { OrderForbiddenError } from './orders.errors';
import { OrderEventType, DomainEvent } from './orders.events';

export interface OrderProps {
  id: string; tenantId: string; orderNo: string; checkoutGroupId: string | null;
  buyerUserId: string; sellerUserId: string; source: string; currencyCode: string;
  subtotalMinor: bigint; deliveryFeeMinor: bigint; discountMinor: bigint; taxMinor: bigint;
  commissionMinor: bigint; platformFeeMinor: bigint; tdsMinor: bigint; totalMinor: bigint;
  status: OrderStatus; deliveryMethodId: string | null; deliveryAddressId: string | null;
  acceptanceDeadline: Date | null; qualityWindowEnds: Date | null;
  cancelReasonId: string | null; cancelledBy: string | null; version: number;
  createdAt: Date; completedAt: Date | null;
}

const ACCEPTANCE_WINDOW_MS = 24 * 3600_000;
const QUALITY_WINDOW_MS = 24 * 3600_000;

export class Order {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: OrderProps) {}

  /** Build an order from priced items. requiresPayment ⇒ starts at payment_pending. */
  static place(input: {
    id: string; tenantId: string; orderNo: string; checkoutGroupId: string | null; buyerUserId: string;
    sellerUserId: string; source: string; currencyCode: string; items: OrderItem[];
    deliveryFeeMinor?: bigint; discountMinor?: bigint; deliveryMethodId: string | null; deliveryAddressId: string | null;
    requiresPayment: boolean; now?: Date;
  }): Order {
    const now = input.now ?? new Date();
    const subtotal = input.items.reduce((s, it) => s + it.props.lineTotalMinor, 0n);
    const delivery = input.deliveryFeeMinor ?? 0n;
    const discount = input.discountMinor ?? 0n;
    // tax/commission/platform_fee/tds are computed at settlement (payments module) — 0 at placement.
    const total = subtotal + delivery - discount;
    const o = new Order({
      id: input.id, tenantId: input.tenantId, orderNo: input.orderNo, checkoutGroupId: input.checkoutGroupId,
      buyerUserId: input.buyerUserId, sellerUserId: input.sellerUserId, source: input.source, currencyCode: input.currencyCode,
      subtotalMinor: subtotal, deliveryFeeMinor: delivery, discountMinor: discount, taxMinor: 0n,
      commissionMinor: 0n, platformFeeMinor: 0n, tdsMinor: 0n, totalMinor: total < 0n ? 0n : total,
      status: input.requiresPayment ? 'payment_pending' : 'created',
      deliveryMethodId: input.deliveryMethodId, deliveryAddressId: input.deliveryAddressId,
      acceptanceDeadline: new Date(now.getTime() + ACCEPTANCE_WINDOW_MS), qualityWindowEnds: null,
      cancelReasonId: null, cancelledBy: null, version: 1, createdAt: now, completedAt: null,
    });
    o.events.push({ type: OrderEventType.Created, payload: { orderId: o.props.id, totalMinor: o.props.totalMinor.toString(), sellerUserId: o.props.sellerUserId } });
    if (input.requiresPayment) o.events.push({ type: OrderEventType.PaymentRequired, payload: { orderId: o.props.id, totalMinor: o.props.totalMinor.toString() } });
    return o;
  }
  static rehydrate(props: OrderProps): Order { return new Order(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get version() { return this.props.version; }
  get buyerUserId() { return this.props.buyerUserId; }
  get sellerUserId() { return this.props.sellerUserId; }
  get createdAt() { return this.props.createdAt; }
  toProps(): Readonly<OrderProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  private to(status: OrderStatus, evt: string, payload: Record<string, unknown> = {}, by?: string): void {
    const from = this.props.status;
    assertTransition(from, status);
    this.props.status = status;
    this.events.push({ type: OrderEventType.StatusChanged, payload: { orderId: this.props.id, from, to: status, by } });
    this.events.push({ type: evt, payload: { orderId: this.props.id, ...payload } });
  }

  /** Online payment succeeded → confirm (payments module calls this via event handler). */
  markPaid(): void { if (this.props.status === 'payment_pending') this.to('confirmed', OrderEventType.Confirmed, {}, undefined); }
  confirm(bySeller: string): void { this.assertSeller(bySeller); this.to('confirmed', OrderEventType.Confirmed, {}, bySeller); }
  markPacked(bySeller: string): void { this.assertSeller(bySeller); this.to('packed', OrderEventType.Packed, {}, bySeller); }
  markReady(bySeller: string): void { this.assertSeller(bySeller); this.to('ready', OrderEventType.Ready, {}, bySeller); }
  markDelivered(by: string, now: Date = new Date()): void {
    this.to('delivered', OrderEventType.Delivered, {}, by);
    this.props.qualityWindowEnds = new Date(now.getTime() + QUALITY_WINDOW_MS);
  }
  complete(now: Date = new Date()): void { this.to('completed', OrderEventType.Completed, {}); this.props.completedAt = now; }
  dispute(by: string, note?: string): void { this.to('disputed', OrderEventType.Disputed, { note }, by); }

  cancel(by: string, reasonId: string | null, isBuyer: boolean): void {
    if (!isCancellable(this.props.status)) throw new OrderForbiddenError(`Order cannot be cancelled in status ${this.props.status}`);
    if (isBuyer && this.props.buyerUserId !== by) throw new OrderForbiddenError();
    if (!isBuyer && this.props.sellerUserId !== by) throw new OrderForbiddenError();
    this.props.cancelReasonId = reasonId; this.props.cancelledBy = by;
    this.to('cancelled', OrderEventType.Cancelled, { reasonId, by, role: isBuyer ? 'buyer' : 'seller' }, by);
  }

  /** System/admin cancellation (jobs, moderation) — bypasses buyer/seller ownership but still
   *  obeys the state machine (only cancellable states). */
  systemCancel(reason: string): void {
    if (!isCancellable(this.props.status)) throw new OrderForbiddenError(`Order cannot be cancelled in status ${this.props.status}`);
    this.props.cancelledBy = 'system';
    this.to('cancelled', OrderEventType.Cancelled, { reason, by: 'system', role: 'system' });
  }

  private assertSeller(by: string): void { if (this.props.sellerUserId !== by) throw new OrderForbiddenError('Only the seller may do this'); }
}
