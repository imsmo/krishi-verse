// modules/support/domain/support.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class TicketNotFoundError extends DomainError { constructor(id: string) { super('TICKET_NOT_FOUND', `Ticket ${id} not found`, 404, { id }); } }
export class InvalidTicketError extends DomainError { constructor(detail: string) { super('TICKET_INVALID', detail, 422, { detail }); } }
export class TicketNotResolvedError extends DomainError { constructor(status: string) { super('TICKET_NOT_RESOLVED', `Ticket is ${status}; CSAT is only for a resolved/closed ticket`, 409, { status }); } }
export class SupportForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('SUPPORT_FORBIDDEN', detail, 403, {}); } }
