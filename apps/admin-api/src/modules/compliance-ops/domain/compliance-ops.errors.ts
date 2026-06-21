// apps/admin-api/src/modules/compliance-ops/domain/compliance-ops.errors.ts · typed errors → HTTP via
// HttpException subclasses with stable codes (mirrors recon-monitor / tenant-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class DsrNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('DSR_NOT_FOUND', `data-subject request ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class ErasureCoolingActiveError extends DomainHttpError {
  constructor(coolingEndsAt: string) { super('DSR_ERASURE_COOLING_ACTIVE', `erasure cannot complete until the cooling window ends`, HttpStatus.CONFLICT, { coolingEndsAt }); }
}
export class ExportJobNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('EXPORT_JOB_NOT_FOUND', `data export job ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class ExportAlreadyDecidedError extends DomainHttpError {
  constructor(status: string) { super('EXPORT_ALREADY_DECIDED', `export job already ${status}`, HttpStatus.CONFLICT, { status }); }
}
export class BreachNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('BREACH_NOT_FOUND', `breach ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvalidRetentionPolicyError extends DomainHttpError {
  constructor(detail: string) { super('RETENTION_POLICY_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidBreachUpdateError extends DomainHttpError {
  constructor(detail: string) { super('BREACH_UPDATE_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
