// shared/errors/app-error.ts
// Base typed error. Carries a stable code, HTTP status, and structured details.
// core/http/exception.filter maps code → i18n message + envelope.
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
    readonly details?: Record<string, unknown>,
    readonly retryable = false,
  ) { super(message); this.name = new.target.name; }
  toEnvelope(requestId: string) {
    return { error: { code: this.code, message: this.message, details: this.details ?? {} },
             meta: { request_id: requestId, timestamp: new Date().toISOString() } };
  }
}
/** Business-rule violation (4xx). */
export class DomainError extends AppError {}
/** Infrastructure failure (5xx, usually retryable). */
export class InfraError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 503, details, true);
  }
}
