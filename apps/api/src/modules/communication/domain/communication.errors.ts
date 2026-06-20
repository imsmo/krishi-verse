// modules/communication/domain/communication.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class NotificationNotFoundError extends DomainError {
  constructor(id: string) { super('NOTIFICATION_NOT_FOUND', `Notification ${id} not found`, 404, { id }); }
}
export class NotificationEventNotFoundError extends DomainError {
  constructor(code: string) { super('NOTIFICATION_EVENT_NOT_FOUND', `Notification event '${code}' not in the catalog`, 404, { code }); }
}
export class NoTemplateError extends DomainError {
  constructor(eventCode: string, channel: string, languageCode: string) {
    super('NOTIFICATION_NO_TEMPLATE', `No active template for ${eventCode}/${channel}/${languageCode}`, 422, { eventCode, channel, languageCode });
  }
}
export class InvalidChannelError extends DomainError {
  constructor(channel: string) { super('NOTIFICATION_INVALID_CHANNEL', `Unknown channel '${channel}'`, 400, { channel }); }
}
export class CannotOptOutError extends DomainError {
  constructor(eventCode: string) { super('NOTIFICATION_CANNOT_OPT_OUT', `Event '${eventCode}' is mandatory and cannot be disabled`, 409, { eventCode }); }
}
export class IllegalNotificationTransitionError extends DomainError {
  constructor(from: string, to: string) { super('NOTIFICATION_ILLEGAL_TRANSITION', `Cannot move notification ${from}→${to}`, 409, { from, to }); }
}
export class CommForbiddenError extends DomainError {
  constructor(detail = 'forbidden') { super('COMM_FORBIDDEN', detail, 403, {}); }
}
