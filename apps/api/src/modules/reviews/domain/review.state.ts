// modules/reviews/domain/review.state.ts · the reviews.status state machine (Law 5).
// Mirrors the documented status values in db/migrations/0005_commerce.sql (reviews.status varchar):
//   published | hidden | under_moderation | removed
import { DomainError } from '../../../shared/errors/app-error';

export const REVIEW_STATUSES = ['published', 'hidden', 'under_moderation', 'removed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ReviewStatus, readonly ReviewStatus[]>> = Object.freeze({
  published:        ['under_moderation', 'hidden', 'removed'],
  under_moderation: ['published', 'hidden', 'removed'],
  hidden:           ['published', 'removed'],
  removed:          [],                                   // terminal (soft-deleted; never resurrected)
});

export class IllegalReviewTransitionError extends DomainError {
  constructor(from: string, to: string) { super('REVIEW_ILLEGAL_TRANSITION', `Cannot move review ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ReviewStatus, to: ReviewStatus): void { if (!canTransition(from, to)) throw new IllegalReviewTransitionError(from, to); }
/** Only published reviews count toward public aggregates and appear in public lists. */
export function isVisible(s: ReviewStatus): boolean { return s === 'published'; }
/** The author may still edit while the review isn't soft-removed. */
export function isEditable(s: ReviewStatus): boolean { return s !== 'removed'; }
