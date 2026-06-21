// apps/admin-api/src/modules/schemes-registry-ops/domain/schemes-registry.errors.ts · typed errors → HTTP via
// HttpException subclasses with stable codes (mirrors the other ops modules). Covers the government-scheme master:
// scheme_authorities (issuing bodies) + schemes (the code-keyed, versioned catalogue).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}

/* ---------------- not-found (404 — never 403, no enumeration leak) ---------------- */
export class AuthorityNotFoundError extends DomainHttpError {
  constructor(id: string) { super('SCHEME_AUTHORITY_NOT_FOUND', `scheme authority '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}
export class SchemeNotFoundError extends DomainHttpError {
  constructor(id: string) { super('SCHEME_NOT_FOUND', `scheme '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}

/* ---------------- validation (422) ---------------- */
export class InvalidSchemeInputError extends DomainHttpError {
  constructor(detail: string) { super('SCHEME_INPUT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
/** category_id must reference an ACTIVE platform lookup_value of type 'scheme_category'. */
export class SchemeCategoryInvalidError extends DomainHttpError {
  constructor(id: string) { super('SCHEME_CATEGORY_INVALID', `category '${id}' is not an active 'scheme_category' lookup value`, HttpStatus.UNPROCESSABLE_ENTITY, { id }); }
}

/* ---------------- conflict (409) ---------------- */
export class DuplicateSchemeCodeError extends DomainHttpError {
  constructor(code: string) { super('SCHEME_CODE_EXISTS', `scheme code '${code}' already exists`, HttpStatus.CONFLICT, { code }); }
}
/** activate/deactivate (or any patch) is a no-op — the entity is already in the requested state. */
export class SchemeAlreadyInStateError extends DomainHttpError {
  constructor(kind: string, isActive: boolean) { super('SCHEME_ALREADY_IN_STATE', `${kind} is already ${isActive ? 'active' : 'inactive'}`, HttpStatus.CONFLICT, { isActive }); }
}
