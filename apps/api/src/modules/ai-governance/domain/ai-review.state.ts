// modules/ai-governance/domain/ai-review.state.ts · the ai_review_queue.status state machine (Law 5).
// Mirrors the status values in db/migrations/0013:  pending → in_review → accepted | rejected.
// A reviewer CLAIMS a pending item (pending→in_review), then RESOLVES it (in_review→accepted|rejected). A
// pending item may also be resolved directly (pending→accepted|rejected) for fast triage. accepted/rejected
// are terminal.
import { DomainError } from '../../../shared/errors/app-error';
import { ReviewStatus } from './ai-governance.events';

const TRANSITIONS: Readonly<Record<ReviewStatus, readonly ReviewStatus[]>> = Object.freeze({
  pending:   ['in_review', 'accepted', 'rejected'],
  in_review: ['accepted', 'rejected', 'pending'],   // pending = release the claim back to the queue
  accepted:  [],
  rejected:  [],
});

export class IllegalReviewTransitionError extends DomainError {
  constructor(from: string, to: string) { super('AI_REVIEW_ILLEGAL_TRANSITION', `Cannot move review ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ReviewStatus, to: ReviewStatus): void { if (!canTransition(from, to)) throw new IllegalReviewTransitionError(from, to); }
export function isOpen(s: ReviewStatus): boolean { return s === 'pending' || s === 'in_review'; }
export function isTerminal(s: ReviewStatus): boolean { return s === 'accepted' || s === 'rejected'; }
