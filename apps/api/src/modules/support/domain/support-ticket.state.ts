// modules/support/domain/support-ticket.state.ts · STATE MACHINE for support_tickets.status (Law 5).
// ticket_status ENUM = open|pending_customer|pending_internal|escalated|resolved|closed|reopened (db 0012).
//   open ↔ pending_customer ↔ pending_internal ↔ escalated → resolved → closed ; resolved/closed → reopened → open.
import { DomainError } from '../../../shared/errors/app-error';

export const TICKET_STATUSES = ['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed', 'reopened'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
const WORKING: readonly TicketStatus[] = ['open', 'pending_customer', 'pending_internal', 'escalated', 'reopened'];

const TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = Object.freeze({
  open:             ['pending_customer', 'pending_internal', 'escalated', 'resolved'],
  pending_customer: ['open', 'pending_internal', 'escalated', 'resolved'],
  pending_internal: ['open', 'pending_customer', 'escalated', 'resolved'],
  escalated:        ['open', 'pending_internal', 'resolved'],
  reopened:         ['pending_customer', 'pending_internal', 'escalated', 'resolved'],
  resolved:         ['closed', 'reopened'],
  closed:           ['reopened'],
});
export class IllegalTicketTransitionError extends DomainError {
  constructor(from: string, to: string) { super('TICKET_ILLEGAL_TRANSITION', `Cannot move ticket ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: TicketStatus, to: TicketStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: TicketStatus, to: TicketStatus): void { if (!canTransition(from, to)) throw new IllegalTicketTransitionError(from, to); }
export function isWorking(s: TicketStatus): boolean { return WORKING.includes(s); }
export function isClosable(s: TicketStatus): boolean { return s === 'resolved' || s === 'closed'; }
