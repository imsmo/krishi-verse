// modules/communication/domain/messaging.events.ts · messaging integration events (via outbox) + vocab.
// MessagePosted is the bridge into the notification spine: the notification-event-map turns it into a
// 'chat.message_posted' catalog event → push/in-app alert to the OTHER participants.
export const MessagingEventType = {
  ConversationOpened:  'comm.conversation_opened',
  ConversationLocked:  'comm.conversation_locked',
  MessagePosted:       'comm.message_posted',
  MessageFlagged:      'comm.message_flagged',
  MaskedCallInitiated: 'comm.masked_call_initiated',
  MaskedCallCompleted: 'comm.masked_call_completed',
} as const;
export type MessagingEventType = (typeof MessagingEventType)[keyof typeof MessagingEventType];

export type DomainEvent = { type: string; payload: Record<string, unknown> };

// Where a conversation hangs (PRD §9). 'direct' = peer DM; the rest are linked to another aggregate.
// 'listing' (KV-BL-031, 03_API_CONTRACT_DELTA.md) = a buyer inquiry thread about a specific listing — added so
// GET /v1/listings/:id/inquiries can filter conversations by (contextType='listing', contextId=<listingId>)
// instead of buyer inquiries hiding under the generic 'direct' bucket with no queryable context. context_type is a
// code-side vocab, NOT a DB enum/CHECK (ADR-0006 — see conversations.context_type varchar(40), no CHECK) so this
// is a pure code addition, zero migration.
export const CONTEXT_TYPES = ['order', 'requirement', 'dispute', 'booking', 'direct', 'support_ticket', 'listing'] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

// Context types where MANY simultaneous threads legitimately share the same (contextType, contextId): a 'direct'
// DM pair may reopen repeatedly, and a 'listing' has ONE thread PER BUYER (many buyers inquire about the same
// listing). ConversationService.open() must NOT auto-reuse "the" existing thread for these types the way it does
// for genuinely 1:1 contexts (order/requirement/dispute/booking/support_ticket) — doing so would hand buyer B
// someone else's conversation with the seller (a real cross-buyer IDOR/mixup), 403-ing them via the participant
// check. GET-side filtering by contextId is unaffected — it lists ALL threads for that context, which is exactly
// what the listing owner's inquiry inbox needs.
// Typed as ReadonlySet<string> (not ContextType) because the DTO's contextType arrives as a plain string (zod
// .enum(CONTEXT_TYPES as unknown as [string, ...string[]]) infers `string`, same as everywhere else it's consumed
// in this service before being cast to ContextType for the entity).
export const MULTI_THREAD_CONTEXT_TYPES: ReadonlySet<string> = new Set<ContextType>(['direct', 'listing']);

export const PARTICIPANT_ROLES = ['member', 'owner', 'agent', 'moderator'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
