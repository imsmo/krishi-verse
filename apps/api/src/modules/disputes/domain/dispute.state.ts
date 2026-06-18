// modules/disputes/domain/dispute.state.ts · the dispute_status state machine (Law 5).
// Mirrors the dispute_status ENUM in db/migrations/0005_commerce.sql:
//   open | seller_responded | under_review | escalated | resolved | rejected | withdrawn
import { DomainError } from '../../../shared/errors/app-error';

export const DISPUTE_STATUSES = ['open', 'seller_responded', 'under_review', 'escalated', 'resolved', 'rejected', 'withdrawn'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<DisputeStatus, readonly DisputeStatus[]>> = Object.freeze({
  open:             ['seller_responded', 'under_review', 'escalated', 'resolved', 'rejected', 'withdrawn'],
  seller_responded: ['under_review', 'escalated', 'resolved', 'rejected', 'withdrawn'],
  under_review:     ['escalated', 'resolved', 'rejected'],
  escalated:        ['under_review', 'resolved', 'rejected'],
  resolved:         [],
  rejected:         [],
  withdrawn:        [],
});

export class IllegalDisputeTransitionError extends DomainError {
  constructor(from: string, to: string) { super('DISPUTE_ILLEGAL_TRANSITION', `Cannot move dispute ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: DisputeStatus, to: DisputeStatus): void { if (!canTransition(from, to)) throw new IllegalDisputeTransitionError(from, to); }
/** Still being worked (parties can message; moderator can act). */
export function isActive(s: DisputeStatus): boolean { return s === 'open' || s === 'seller_responded' || s === 'under_review' || s === 'escalated'; }
export function isTerminal(s: DisputeStatus): boolean { return s === 'resolved' || s === 'rejected' || s === 'withdrawn'; }
