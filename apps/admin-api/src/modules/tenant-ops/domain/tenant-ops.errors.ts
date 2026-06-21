// apps/admin-api/src/modules/tenant-ops/domain/tenant-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses, with stable codes in the body (mirrors ai-models-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class TenantNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('TENANT_NOT_FOUND', `tenant ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvalidTenantOpError extends DomainHttpError {
  constructor(detail: string) { super('TENANT_OP_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidLimitOverrideError extends DomainHttpError {
  constructor(detail: string) { super('TENANT_LIMIT_OVERRIDE_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
