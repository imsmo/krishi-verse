// modules/warehousing/domain/storage-booking.state.ts · STATE MACHINE for storage_bookings.status (Law 5).
//   requested → confirmed → stored → released  (+ cancel from requested|confirmed)
// 'partially_released' is reserved for the deferred split-release flow; not reachable here.
import { DomainError } from '../../../shared/errors/app-error';

export const BOOKING_STATUSES = ['requested', 'confirmed', 'stored', 'released', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = Object.freeze({
  requested: ['confirmed', 'cancelled'],
  confirmed: ['stored', 'cancelled'],
  stored:    ['released'],
  released:  [],
  cancelled: [],
});
export class IllegalBookingTransitionError extends DomainError {
  constructor(from: string, to: string) { super('STORAGE_BOOKING_ILLEGAL_TRANSITION', `Cannot move booking ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: BookingStatus, to: BookingStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BookingStatus, to: BookingStatus): void { if (!canTransition(from, to)) throw new IllegalBookingTransitionError(from, to); }
export function isStored(s: BookingStatus): boolean { return s === 'stored'; }
