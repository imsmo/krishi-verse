// apps/admin-api/src/modules/flags-ops/domain/flags-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors recon-monitor / compliance-ops / billing-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class FlagNotFoundError extends DomainHttpError {
  constructor(key: string) { super('FEATURE_FLAG_NOT_FOUND', `feature flag '${key}' not found`, HttpStatus.NOT_FOUND, { key }); }
}
export class FlagAlreadyExistsError extends DomainHttpError {
  constructor(key: string) { super('FEATURE_FLAG_EXISTS', `feature flag '${key}' already exists`, HttpStatus.CONFLICT, { key }); }
}
export class InvalidFlagKeyError extends DomainHttpError {
  constructor(detail: string) { super('FEATURE_FLAG_KEY_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidRolloutError extends DomainHttpError {
  constructor(detail: string) { super('FEATURE_FLAG_ROLLOUT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidTargetingError extends DomainHttpError {
  constructor(detail: string) { super('FEATURE_FLAG_TARGETING_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
/** The flag is kill-switch LOCKED: enable / rollout / targeting changes are refused until it is unlocked. */
export class FlagLockedError extends DomainHttpError {
  constructor(key: string) { super('FEATURE_FLAG_LOCKED', `feature flag '${key}' is kill-switch locked; unlock it (with a reason) before changing it`, HttpStatus.CONFLICT, { key }); }
}
export class FlagNotLockedError extends DomainHttpError {
  constructor(key: string) { super('FEATURE_FLAG_NOT_LOCKED', `feature flag '${key}' is not locked`, HttpStatus.CONFLICT, { key }); }
}
