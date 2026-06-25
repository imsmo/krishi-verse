// modules/tenant-webhooks/domain/tenant-webhooks.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class WebhookNotFoundError extends NotFoundError {
  constructor(id: string) { super('Webhook endpoint not found'); (this as any).code = 'WEBHOOK_ENDPOINT_NOT_FOUND'; (this as any).details = { id }; }
}
export class WebhookUrlUnsafeError extends DomainError {
  constructor(reason: string) { super('WEBHOOK_URL_UNSAFE', `Webhook URL rejected: ${reason}`, 422, { reason }); }
}
export class WebhookEventUnknownError extends DomainError {
  constructor(code: string) { super('WEBHOOK_EVENT_UNKNOWN', `Unknown webhook event: ${code}`, 422, { code }); }
}
export class WebhooksForbiddenError extends AppError {
  constructor(message = 'Not allowed to manage webhooks') { super('WEBHOOKS_FORBIDDEN', message, 403); }
}
