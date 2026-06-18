// modules/disputes/domain/disputes.events.ts · integration events (via outbox, Law 4).
export const DisputeEventType = {
  Opened:          'disputes.dispute_opened',          // → orders pauses the order (sets it 'disputed')
  SellerResponded: 'disputes.dispute_seller_responded',
  UnderReview:     'disputes.dispute_under_review',
  Escalated:       'disputes.dispute_escalated',
  Resolved:        'disputes.dispute_resolved',         // → orders applies refund/release (downstream)
  Withdrawn:       'disputes.dispute_withdrawn',
  MessagePosted:   'disputes.dispute_message_posted',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const RESOLUTION_TYPES = ['refund_full', 'refund_partial', 'replacement', 'rejected'] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
