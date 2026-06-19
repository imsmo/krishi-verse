// modules/exports/domain/export-shipment.state.ts · STATE MACHINE for export_shipments.status (Law 5).
// Linear export lifecycle (no money in-platform; 'paid' = LC/bank settlement confirmed out-of-band):
//   draft → docs_in_progress → inspection → shipped → delivered → paid → closed
import { DomainError } from '../../../shared/errors/app-error';

export const SHIPMENT_STATUSES = ['draft','docs_in_progress','inspection','shipped','delivered','paid','closed'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = Object.freeze({
  draft:            ['docs_in_progress'],
  docs_in_progress: ['inspection'],
  inspection:       ['shipped'],
  shipped:          ['delivered'],
  delivered:        ['paid'],
  paid:             ['closed'],
  closed:           [],
});
export class IllegalShipmentTransitionError extends DomainError {
  constructor(from: string, to: string) { super('EXPORT_SHIPMENT_ILLEGAL_TRANSITION', `Cannot move shipment ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ShipmentStatus, to: ShipmentStatus): void { if (!canTransition(from, to)) throw new IllegalShipmentTransitionError(from, to); }
export function isTerminal(s: ShipmentStatus): boolean { return s === 'closed'; }
