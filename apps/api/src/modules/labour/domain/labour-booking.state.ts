// modules/labour/domain/labour-booking.state.ts · STATE MACHINE for labour_bookings.status (Law 5).
// Subset of the booking_status enum (db/migrations/0008_labour.sql) used by this build's spine:
//   open → in_progress → completed → paid   (+ cancel from open/in_progress; expire from open)
// The fuller enum (draft/pending_worker/accepted/rejected/disputed/no_show) is reserved for the
// deferred attendance/crew/grievance flows; transitions into them are not permitted here.
import { DomainError } from '../../../shared/errors/app-error';

export const BOOKING_STATUSES = ['open', 'in_progress', 'completed', 'paid', 'cancelled', 'expired'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = Object.freeze({
  open:        ['in_progress', 'cancelled', 'expired'],
  in_progress: ['completed', 'cancelled'],
  completed:   ['paid'],
  paid:        [],
  cancelled:   [],
  expired:     [],
});

export class IllegalBookingTransitionError extends DomainError {
  constructor(from: string, to: string) { super('BOOKING_ILLEGAL_TRANSITION', `Cannot move booking ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: BookingStatus, to: BookingStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BookingStatus, to: BookingStatus): void { if (!canTransition(from, to)) throw new IllegalBookingTransitionError(from, to); }
/** Workers may still be assigned only while the booking is open. */
export function acceptsAssignments(s: BookingStatus): boolean { return s === 'open'; }
/** Terminal states no job/worker action can change. */
export function isTerminal(s: BookingStatus): boolean { return s === 'paid' || s === 'cancelled' || s === 'expired'; }
