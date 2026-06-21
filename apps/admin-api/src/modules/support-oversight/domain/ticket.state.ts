// apps/admin-api/src/modules/support-oversight/domain/ticket.state.ts · a MIRROR of the support_tickets status
// state machine (apps/api modules/support/domain/support-ticket.state.ts), kept in sync so the god-mode oversight
// plane drives escalation through the SAME legal transitions (Law 5). admin-api can't import apps/api module code
// (separate app), so the transitions are reproduced here. ticket_status ENUM = db/migrations/0012.
export const TICKET_STATUSES = ['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed', 'reopened'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
const WORKING: readonly TicketStatus[] = ['open', 'pending_customer', 'pending_internal', 'escalated', 'reopened'];

import { IllegalTicketTransitionError } from './support-oversight.errors';

const TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = Object.freeze({
  open:             ['pending_customer', 'pending_internal', 'escalated', 'resolved'],
  pending_customer: ['open', 'pending_internal', 'escalated', 'resolved'],
  pending_internal: ['open', 'pending_customer', 'escalated', 'resolved'],
  escalated:        ['open', 'pending_internal', 'resolved'],
  reopened:         ['pending_customer', 'pending_internal', 'escalated', 'resolved'],
  resolved:         ['closed', 'reopened'],
  closed:           ['reopened'],
});

export function canTransition(from: TicketStatus, to: TicketStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: TicketStatus, to: TicketStatus): void { if (!canTransition(from, to)) throw new IllegalTicketTransitionError(from, to); }
export function isWorking(s: TicketStatus): boolean { return WORKING.includes(s); }
export function isTerminalForEscalation(s: TicketStatus): boolean { return s === 'resolved' || s === 'closed'; }
