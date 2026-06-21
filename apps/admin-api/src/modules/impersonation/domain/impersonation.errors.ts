// apps/admin-api/src/modules/impersonation/domain/impersonation.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors the other ops modules).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
/** Kill-switch (Law 10): act-as is OFF unless explicitly enabled. Fail-closed. */
export class ImpersonationDisabledError extends DomainHttpError {
  constructor() { super('IMPERSONATION_DISABLED', 'impersonation is disabled (kill-switch); enable it deliberately to use act-as', HttpStatus.FORBIDDEN); }
}
export class GrantNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('IMPERSONATION_GRANT_NOT_FOUND', `impersonation grant ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class ActiveGrantExistsError extends DomainHttpError {
  constructor() { super('IMPERSONATION_ACTIVE_GRANT_EXISTS', 'an active impersonation grant already exists for this operator + target user; end it first', HttpStatus.CONFLICT); }
}
export class InvalidScopeError extends DomainHttpError {
  constructor(detail: string) { super('IMPERSONATION_SCOPE_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidTtlError extends DomainHttpError {
  constructor(detail: string) { super('IMPERSONATION_TTL_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class SelfImpersonationError extends DomainHttpError {
  constructor() { super('IMPERSONATION_SELF', 'an operator cannot impersonate themselves', HttpStatus.UNPROCESSABLE_ENTITY); }
}
/** Never act as a platform/staff/god account — impersonation is for TENANT users only. */
export class CannotImpersonatePrivilegedError extends DomainHttpError {
  constructor() { super('IMPERSONATION_TARGET_PRIVILEGED', 'cannot impersonate a platform/staff account; act-as is for tenant users only', HttpStatus.FORBIDDEN); }
}
export class TargetUserNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('IMPERSONATION_TARGET_NOT_FOUND', `target user ${ref} not found in that tenant`, HttpStatus.NOT_FOUND, { ref }); }
}
export class IllegalGrantTransitionError extends Error {
  readonly code = 'IMPERSONATION_GRANT_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move impersonation grant ${from}→${to}`);
    this.name = 'IllegalGrantTransitionError';
  }
}
