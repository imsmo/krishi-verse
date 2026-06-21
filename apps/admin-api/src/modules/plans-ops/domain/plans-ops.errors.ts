// apps/admin-api/src/modules/plans-ops/domain/plans-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors recon-monitor / compliance-ops / billing-ops / flags-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class PlanNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('PLAN_NOT_FOUND', `plan ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class PlanVersionExistsError extends DomainHttpError {
  constructor(code: string, version: number, country: string) { super('PLAN_VERSION_EXISTS', `plan ${code} v${version} for ${country} already exists`, HttpStatus.CONFLICT, { code, version, country }); }
}
export class InvalidPlanError extends DomainHttpError {
  constructor(detail: string) { super('PLAN_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
/** Prices/composition of a PUBLISHED plan are immutable (grandfathering) — change them by creating a new version. */
export class PlanImmutableError extends DomainHttpError {
  constructor(detail: string) { super('PLAN_IMMUTABLE', detail, HttpStatus.CONFLICT, { detail }); }
}
export class FeatureNotFoundError extends DomainHttpError {
  constructor(code: string) { super('FEATURE_NOT_FOUND', `feature '${code}' is not in the platform feature catalogue`, HttpStatus.NOT_FOUND, { code }); }
}
export class IllegalPlanTransitionError extends Error {
  readonly code = 'PLAN_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move plan ${from}→${to}`);
    this.name = 'IllegalPlanTransitionError';
  }
}
