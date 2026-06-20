// modules/services-marketplace/domain/service-booking.state.ts · STATE MACHINE for service_bookings.status (Law 5).
//   requested → confirmed → in_progress → completed   (+ cancel from requested|confirmed)
// 'disputed' is reserved for the deferred disputes wiring (not reachable here).
import { DomainError } from '../../../shared/errors/app-error';

export const BOOKING_STATUSES = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = Object.freeze({
  requested:   ['confirmed', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
});
export class IllegalBookingTransitionError extends DomainError {
  constructor(from: string, to: string) { super('SERVICE_BOOKING_ILLEGAL_TRANSITION', `Cannot move booking ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: BookingStatus, to: BookingStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BookingStatus, to: BookingStatus): void { if (!canTransition(from, to)) throw new IllegalBookingTransitionError(from, to); }
export function isCompletable(s: BookingStatus): boolean { return s === 'in_progress'; }
