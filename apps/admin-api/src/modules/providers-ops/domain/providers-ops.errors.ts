// apps/admin-api/src/modules/providers-ops/domain/providers-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors the other ops modules).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class ProviderNotFoundError extends DomainHttpError {
  constructor(code: string) { super('PROVIDER_NOT_FOUND', `integration provider '${code}' not found`, HttpStatus.NOT_FOUND, { code }); }
}
/** Enable/disable is a no-op — the provider is already in the requested state. */
export class ProviderAlreadyInStateError extends DomainHttpError {
  constructor(code: string, isActive: boolean) { super('PROVIDER_ALREADY_IN_STATE', `provider '${code}' is already ${isActive ? 'active' : 'inactive'}`, HttpStatus.CONFLICT, { code, isActive }); }
}
export class InvalidCategoryError extends DomainHttpError {
  constructor(detail: string) { super('PROVIDER_CATEGORY_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
