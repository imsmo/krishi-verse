// shared/errors/app-error.ts
// Base typed error. Carries a stable code, HTTP status, and structured details.
// core/http/exception.filter maps code → i18n message + envelope.
//
// Every failure in the platform MUST be one of these (never a bare
// `throw new Error(...)` in production paths) so the HTTP layer can map it to a
// stable machine code + localized message + the right status, and so logs and
// metrics can be aggregated by `code`.
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

/** Business-rule violation (4xx). Subclassed by each module's domain errors. */
export class DomainError extends AppError {}

/** Infrastructure failure (5xx, usually retryable). */
export class InfraError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 503, details, true);
  }
}

// ---------------------------------------------------------------------------
// Common HTTP-shaped errors used by the core plumbing (guards, pipes,
// controllers). Kept here so there is ONE import path for all of them.
// ---------------------------------------------------------------------------

/** 400 — malformed request the client can fix (missing header, bad combination). */
export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BAD_REQUEST', message, 400, details);
  }
}

/** 422 — request was well-formed but failed validation (zod). */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', message, 422, details);
  }
}

/** 401 — missing/invalid credentials. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super('UNAUTHORIZED', message, 401, details);
  }
}

/** 403 — authenticated but not allowed. */
export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied', details?: Record<string, unknown>) {
    super('FORBIDDEN', message, 403, details);
  }
}

/** 404 — resource not found (generic; modules usually define their own). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super('NOT_FOUND', message, 404, details);
  }
}

/** 409 — conflict (concurrency, duplicate, illegal state). */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
  }
}

/** 429 — rate limit exceeded; retryable after a wait. */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details?: Record<string, unknown>) {
    super('TOO_MANY_REQUESTS', message, 429, details, true);
  }
}

/** 409 — plan/usage quota exhausted (distinct code for billing UX). */
export class QuotaExceededError extends AppError {
  constructor(metric: string, limit: number, used: number) {
    super('QUOTA_EXCEEDED', `Plan limit reached for ${metric} (${used}/${limit})`, 409,
      { metric, limit, used });
  }
}
