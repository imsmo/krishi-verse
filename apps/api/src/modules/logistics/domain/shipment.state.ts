// modules/logistics/domain/shipment.state.ts · the shipment_status state machine (Law 5).
// Mirrors the shipment_status ENUM in db/migrations/0007_logistics.sql:
//   pending | assigned | pickup_scheduled | picked_up | in_transit | at_hub | out_for_delivery
//   | delivered | failed | returned | cancelled
import { DomainError } from '../../../shared/errors/app-error';

export const SHIPMENT_STATUSES = [
  'pending', 'assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'at_hub',
  'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = Object.freeze({
  pending:          ['assigned', 'cancelled'],
  assigned:         ['pickup_scheduled', 'picked_up', 'cancelled'],
  pickup_scheduled: ['picked_up', 'cancelled', 'failed'],
  picked_up:        ['in_transit', 'at_hub', 'out_for_delivery', 'failed'],
  in_transit:       ['at_hub', 'out_for_delivery', 'failed'],
  at_hub:           ['in_transit', 'out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed:           ['out_for_delivery', 'returned', 'cancelled'],   // re-attempt or give up
  delivered:        [],
  returned:         [],
  cancelled:        [],
});

export class IllegalShipmentTransitionError extends DomainError {
  constructor(from: string, to: string) { super('SHIPMENT_ILLEGAL_TRANSITION', `Cannot move shipment ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ShipmentStatus, to: ShipmentStatus): void { if (!canTransition(from, to)) throw new IllegalShipmentTransitionError(from, to); }
export function isTerminal(s: ShipmentStatus): boolean { return s === 'delivered' || s === 'returned' || s === 'cancelled'; }
/** A shipment can still be re-assigned/scheduled (pre-pickup). */
export function isPrePickup(s: ShipmentStatus): boolean { return s === 'pending' || s === 'assigned' || s === 'pickup_scheduled'; }
