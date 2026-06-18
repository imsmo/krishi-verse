// modules/reviews/domain/reviews.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class ReviewNotFoundError extends NotFoundError { constructor(id: string) { super('Review not found'); (this as any).details = { id }; } }
/** The actor is not the review's author / target seller / a moderator, as required. */
export class ReviewForbiddenError extends AppError { constructor(message = 'Not allowed on this review') { super('REVIEW_FORBIDDEN', message, 403); } }
/** The reviewer has no verified-purchase eligibility (no completed order with this counterparty). */
export class NotEligibleToReviewError extends AppError { constructor() { super('REVIEW_NOT_ELIGIBLE', 'You can only review the counterparty of a completed order', 403); } }
/** One review per (order, reviewer, target) — UNIQUE in the schema. */
export class DuplicateReviewError extends AppError { constructor() { super('REVIEW_DUPLICATE', 'You have already reviewed this order', 409); } }
/** Acting on a soft-removed review. */
export class ReviewRemovedError extends AppError { constructor() { super('REVIEW_REMOVED', 'This review has been removed', 409); } }
export class InvalidReviewError extends DomainError { constructor(message: string) { super('REVIEW_INVALID', message, 400); } }
