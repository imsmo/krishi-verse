// modules/support/domain/support.events.ts · integration events (via outbox) + vocab.
export const SupportEventType = {
  TicketOpened:      'support.ticket_opened',
  TicketAssigned:    'support.ticket_assigned',
  TicketFirstResponse:'support.ticket_first_response',
  TicketEscalated:   'support.ticket_escalated',
  TicketResolved:    'support.ticket_resolved',
  TicketClosed:      'support.ticket_closed',
  TicketReopened:    'support.ticket_reopened',
} as const;
export type SupportEventType = (typeof SupportEventType)[keyof typeof SupportEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const TICKET_CHANNELS = ['app', 'whatsapp', 'ivr', 'phone', 'email', 'ambassador'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];
export const TICKET_SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];
