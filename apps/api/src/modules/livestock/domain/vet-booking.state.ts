// modules/livestock/domain/vet-booking.state.ts · STATE MACHINE for vet_bookings.status (Law 5).
// Mirrors the vet_booking_status enum (db/migrations/0009). The VET drives the service lifecycle; the
// FARMER (the payer) confirms completion, which settles the fee through the wallet.
//   requested → accepted | cancelled
//   accepted  → en_route | in_consult | cancelled | no_show     (tele bookings skip en_route)
//   en_route  → in_consult | no_show
//   in_consult → prescribed | completed
//   prescribed → completed
import { DomainError } from '../../../shared/errors/app-error';

export const VET_BOOKING_STATUSES = ['requested','accepted','en_route','in_consult','prescribed','completed','cancelled','no_show'] as const;
export type VetBookingStatus = (typeof VET_BOOKING_STATUSES)[number];

const TRANSITIONS: Readonly<Record<VetBookingStatus, readonly VetBookingStatus[]>> = Object.freeze({
  requested:  ['accepted', 'cancelled'],
  accepted:   ['en_route', 'in_consult', 'cancelled', 'no_show'],
  en_route:   ['in_consult', 'no_show'],
  in_consult: ['prescribed', 'completed'],
  prescribed: ['completed'],
  completed:  [],
  cancelled:  [],
  no_show:    [],
});
export class IllegalVetBookingTransitionError extends DomainError {
  constructor(from: string, to: string) { super('VET_BOOKING_ILLEGAL_TRANSITION', `Cannot move vet booking ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: VetBookingStatus, to: VetBookingStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: VetBookingStatus, to: VetBookingStatus): void { if (!canTransition(from, to)) throw new IllegalVetBookingTransitionError(from, to); }
export function isTerminal(s: VetBookingStatus): boolean { return s === 'completed' || s === 'cancelled' || s === 'no_show'; }
/** Service has been rendered → the farmer may confirm completion + pay. */
export function isCompletable(s: VetBookingStatus): boolean { return s === 'in_consult' || s === 'prescribed'; }
