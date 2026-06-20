// modules/communication/domain/messaging.errors.ts · typed errors, stable codes → HTTP.
// Anti-enumeration: a non-participant gets 404 (NotFound), never 403 — they must not learn the row exists.
import { DomainError } from '../../../shared/errors/app-error';

export class ConversationNotFoundError extends DomainError {
  constructor(id: string) { super('CONVERSATION_NOT_FOUND', `Conversation ${id} not found`, 404, { id }); }
}
export class MessageNotFoundError extends DomainError {
  constructor(id: string) { super('MESSAGE_NOT_FOUND', `Message ${id} not found`, 404, { id }); }
}
export class MaskedCallNotFoundError extends DomainError {
  constructor(id: string) { super('MASKED_CALL_NOT_FOUND', `Masked call ${id} not found`, 404, { id }); }
}
export class ConversationLockedError extends DomainError {
  constructor(id: string) { super('CONVERSATION_LOCKED', `Conversation ${id} is locked to new messages`, 409, { id }); }
}
export class EmptyMessageError extends DomainError {
  constructor() { super('MESSAGE_EMPTY', 'A message needs body, voice, or an attachment', 422, {}); }
}
export class InvalidConversationError extends DomainError {
  constructor(detail: string) { super('CONVERSATION_INVALID', detail, 422, { detail }); }
}
export class MessagingForbiddenError extends DomainError {
  constructor(detail = 'forbidden') { super('MESSAGING_FORBIDDEN', detail, 403, {}); }
}
