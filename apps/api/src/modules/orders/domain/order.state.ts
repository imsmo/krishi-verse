// modules/orders/domain/order.state.ts · THE order_status state machine (Law 5). The ONLY
// place transitions live. Mirrors the order_status enum in db/migrations/0005_commerce.sql.
import { DomainError } from '../../../shared/errors/app-error';

export const ORDER_STATUSES = [
  'created','payment_pending','confirmed','packed','ready','picked_up','in_transit',
  'out_for_delivery','delivered','completed','cancelled','disputed','refunded',
  'partially_refunded','partially_fulfilled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  created:            ['payment_pending', 'confirmed', 'cancelled'],
  payment_pending:    ['confirmed', 'cancelled'],
  confirmed:          ['packed', 'cancelled', 'disputed'],
  packed:             ['ready', 'cancelled', 'disputed'],
  // 'delivered' direct: the pilot exposes only packed→ready→delivered→complete (direct
  // farm-gate sale, no third-party logistics leg), so 'ready' (ready for handover) may go
  // straight to 'delivered' (buyer received). The picked_up/in_transit/out_for_delivery
  // branch remains for the transporter-mediated flow once those endpoints are wired.
  ready:              ['picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'disputed'],
  picked_up:          ['in_transit', 'delivered', 'disputed'],
  in_transit:         ['out_for_delivery', 'delivered', 'disputed'],
  out_for_delivery:   ['delivered', 'disputed'],
  delivered:          ['completed', 'partially_fulfilled', 'disputed'],
  partially_fulfilled:['completed', 'refunded', 'partially_refunded', 'disputed'],
  completed:          ['disputed'],                 // post-delivery dispute window
  disputed:           ['completed', 'refunded', 'partially_refunded', 'cancelled'],
  refunded:           [],
  partially_refunded: ['completed'],
  cancelled:          [],
});

export class IllegalOrderTransitionError extends DomainError {
  constructor(from: string, to: string) { super('ORDER_ILLEGAL_TRANSITION', `Cannot move order ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: OrderStatus, to: OrderStatus): void { if (!canTransition(from, to)) throw new IllegalOrderTransitionError(from, to); }
/** Buyer/seller may cancel only before dispatch. */
export function isCancellable(s: OrderStatus): boolean { return ['created', 'payment_pending', 'confirmed', 'packed', 'ready'].includes(s); }
export function isTerminal(s: OrderStatus): boolean { return s === 'refunded' || s === 'cancelled'; }
