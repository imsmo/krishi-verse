// apps/web-tenant/src/features/orders/lifecycle.ts · PURE helpers for the seller order-detail page. They mirror
// the API's order_status state machine (db/migrations/0005 + orders/domain/order.state.ts) so the console only
// OFFERS legal transitions — the API is always the authority and re-checks every move (we reflect, never grant; a
// raced/illegal action degrades to a message). No framework, no I/O → unit-tested. The seller verbs map to the
// SDK's typed lifecycle methods; intermediate pickup/transit steps are rider/logistics-driven (via shipments), so
// they are intentionally absent here.

export const ORDER_STATUSES = [
  'created', 'payment_pending', 'confirmed', 'packed', 'ready', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'partially_fulfilled', 'completed', 'disputed', 'refunded', 'partially_refunded', 'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  created: ['payment_pending', 'confirmed', 'cancelled'],
  payment_pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled', 'disputed'],
  packed: ['ready', 'cancelled', 'disputed'],
  ready: ['picked_up', 'out_for_delivery', 'cancelled', 'disputed'],
  picked_up: ['in_transit', 'delivered', 'disputed'],
  in_transit: ['out_for_delivery', 'delivered', 'disputed'],
  out_for_delivery: ['delivered', 'disputed'],
  delivered: ['completed', 'partially_fulfilled', 'disputed'],
  partially_fulfilled: ['completed', 'refunded', 'partially_refunded', 'disputed'],
  completed: ['disputed'],
  disputed: ['completed', 'refunded', 'partially_refunded', 'cancelled'],
  refunded: [],
  partially_refunded: ['completed'],
  cancelled: [],
});

export function canTransition(from: string, to: OrderStatus): boolean {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to);
}
export function isCancellable(status: string): boolean {
  return ['created', 'payment_pending', 'confirmed', 'packed', 'ready'].includes(status);
}

/** The seller lifecycle verbs exposed by the SDK, each tagged with the target status it drives. */
export type SellerAction = 'confirm' | 'packed' | 'ready' | 'delivered' | 'complete' | 'cancel';
const VERB_TARGET: Record<Exclude<SellerAction, 'cancel'>, OrderStatus> = {
  confirm: 'confirmed', packed: 'packed', ready: 'ready', delivered: 'delivered', complete: 'completed',
};

/** Ordered list of seller actions that are LEGAL from the given status (cancel last; gated by isCancellable). */
export function sellerActions(status: string): SellerAction[] {
  const out: SellerAction[] = [];
  (['confirm', 'packed', 'ready', 'delivered', 'complete'] as const).forEach((v) => {
    if (canTransition(status, VERB_TARGET[v])) out.push(v);
  });
  if (isCancellable(status)) out.push('cancel');
  return out;
}

export const SELLER_ACTIONS: readonly SellerAction[] = ['confirm', 'packed', 'ready', 'delivered', 'complete', 'cancel'];
export function isSellerAction(x: string): x is SellerAction {
  return (SELLER_ACTIONS as readonly string[]).includes(x);
}
