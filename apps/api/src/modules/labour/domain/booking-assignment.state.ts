// modules/labour/domain/booking-assignment.state.ts · STATE MACHINE for booking_assignments.status (Law 5).
// One row per worker per booking. Subset of booking_status used for the assignment lifecycle:
//   applied → accepted | rejected | expired             (WORKER self-apply to an OPEN booking, API-W8)
//   pending_worker → accepted | rejected | expired      (EMPLOYER proposes → worker consent, PRD §31.5)
//   accepted → paid                                      (wage settled when the booking is paid)
// 'applied' is an interest pool — it does NOT consume a booking slot (see countActive). no_show/disputed
// belong to the deferred attendance flow and are not reachable here.
import { DomainError } from '../../../shared/errors/app-error';

export const ASSIGNMENT_STATUSES = ['applied', 'pending_worker', 'accepted', 'rejected', 'expired', 'paid'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<AssignmentStatus, readonly AssignmentStatus[]>> = Object.freeze({
  applied:        ['accepted', 'rejected', 'expired'],
  pending_worker: ['accepted', 'rejected', 'expired'],
  accepted:       ['paid'],
  rejected:       [],
  expired:        [],
  paid:           [],
});

export class IllegalAssignmentTransitionError extends DomainError {
  constructor(from: string, to: string) { super('ASSIGNMENT_ILLEGAL_TRANSITION', `Cannot move assignment ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: AssignmentStatus, to: AssignmentStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: AssignmentStatus, to: AssignmentStatus): void { if (!canTransition(from, to)) throw new IllegalAssignmentTransitionError(from, to); }
export function isAccepted(s: AssignmentStatus): boolean { return s === 'accepted'; }
