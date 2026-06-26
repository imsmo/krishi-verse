// modules/assistant/domain/assistant.errors.ts · typed errors with stable codes.
import { AppError } from '../../../shared/errors/app-error';

export class InvalidAssistantQueryError extends AppError {
  constructor(detail = 'invalid query') { super('ASSISTANT_INVALID_QUERY', detail, 422); }
}
/** Per-user cost/rate cap tripped — a 429 with which window so the client can back off. */
export class AssistantRateLimitedError extends AppError {
  constructor(limit: 'per_minute' | 'per_day') { super('ASSISTANT_RATE_LIMITED', `assistant rate cap reached (${limit})`, 429, { limit }); }
}
