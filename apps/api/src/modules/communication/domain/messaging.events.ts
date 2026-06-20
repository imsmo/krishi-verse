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
export const CONTEXT_TYPES = ['order', 'requirement', 'dispute', 'booking', 'direct', 'support_ticket'] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

export const PARTICIPANT_ROLES = ['member', 'owner', 'agent', 'moderator'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
