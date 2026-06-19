// modules/equipment/domain/equipment-booking.state.ts · STATE MACHINE for equipment_bookings.status (Law 5).
// Mirrors the rental_status enum subset used by this build's CHC rental spine:
//   requested → quoted → confirmed → in_progress → completed → settled
//   (+ cancel from requested|quoted|confirmed). 'disputed' is reserved for the deferred disputes wiring.
import { DomainError } from '../../../shared/errors/app-error';

export const RENTAL_STATUSES = ['requested','quoted','confirmed','in_progress','completed','settled','cancelled'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

const TRANSITIONS: Readonly<Record<RentalStatus, readonly RentalStatus[]>> = Object.freeze({
  requested:   ['quoted', 'cancelled'],
  quoted:      ['confirmed', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed:   ['settled'],
  settled:     [],
  cancelled:   [],
});
export class IllegalRentalTransitionError extends DomainError {
  constructor(from: string, to: string) { super('RENTAL_ILLEGAL_TRANSITION', `Cannot move booking ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: RentalStatus, to: RentalStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: RentalStatus, to: RentalStatus): void { if (!canTransition(from, to)) throw new IllegalRentalTransitionError(from, to); }
export function isTerminal(s: RentalStatus): boolean { return s === 'settled' || s === 'cancelled'; }
/** Escrowed funds are held while the booking is live (confirmed..completed). */
export function holdsEscrow(s: RentalStatus): boolean { return s === 'confirmed' || s === 'in_progress' || s === 'completed'; }
