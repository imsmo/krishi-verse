// modules/reviews/domain/reviews.events.ts · integration events (via outbox, Law 4).
export const ReviewEventType = {
  Submitted:       'reviews.review_submitted',
  Edited:          'reviews.review_edited',
  SellerResponded: 'reviews.review_seller_responded',
  Moderated:       'reviews.review_moderated',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

/** A review always targets the counterparty of a completed order (two-sided marketplace rating). */
export type ReviewTargetType = 'seller' | 'buyer';
