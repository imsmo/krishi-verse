// modules/disputes/domain/return.state.ts · the returns/RMA status machine (Law 5).
// Mirrors returns.status in db/migrations/0005_commerce.sql:
//   requested | approved | in_transit | received | refunded | rejected
// Flow: buyer REQUESTS → seller/moderator APPROVES (or REJECTS) → buyer ships back (IN_TRANSIT) →
// seller/moderator confirms goods RECEIVED → refund issued (REFUNDED). A request can be REJECTED from
// requested or approved. refunded/rejected are terminal.
import { DomainError } from '../../../shared/errors/app-error';

export const RETURN_STATUSES = ['requested', 'approved', 'in_transit', 'received', 'refunded', 'rejected'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ReturnStatus, readonly ReturnStatus[]>> = Object.freeze({
  requested:  ['approved', 'rejected'],
  approved:   ['in_transit', 'rejected'],
  in_transit: ['received'],
  received:   ['refunded'],
  refunded:   [],
  rejected:   [],
});

export class IllegalReturnTransitionError extends DomainError {
  constructor(from: string, to: string) { super('RETURN_ILLEGAL_TRANSITION', `Cannot move return ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ReturnStatus, to: ReturnStatus): void { if (!canTransition(from, to)) throw new IllegalReturnTransitionError(from, to); }
/** Still in progress (parties/moderator can act). */
export function isActive(s: ReturnStatus): boolean { return s !== 'refunded' && s !== 'rejected'; }
export function isTerminal(s: ReturnStatus): boolean { return s === 'refunded' || s === 'rejected'; }
