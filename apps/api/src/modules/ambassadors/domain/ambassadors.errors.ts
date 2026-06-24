// modules/ambassadors/domain/ambassadors.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class AmbassadorNotFoundError extends DomainError { constructor(id: string) { super('AMBASSADOR_NOT_FOUND', `Ambassador ${id} not found`, 404, { id }); } }
export class ReferralNotFoundError extends DomainError { constructor(id: string) { super('REFERRAL_NOT_FOUND', `Referral ${id} not found`, 404, { id }); } }
export class AlreadyAmbassadorError extends DomainError { constructor(userId: string) { super('ALREADY_AMBASSADOR', `User ${userId} is already an ambassador`, 409, { userId }); } }
export class DuplicateReferralCodeError extends DomainError { constructor(code: string) { super('REFERRAL_CODE_TAKEN', `Referral code '${code}' is already in use`, 409, { code }); } }
export class SelfReferralError extends DomainError { constructor() { super('SELF_REFERRAL', 'You cannot refer yourself', 409, {}); } }
export class NoCommissionPlanError extends DomainError { constructor(eventCode: string) { super('NO_COMMISSION_PLAN', `No active commission plan for '${eventCode}'`, 422, { eventCode }); } }
export class NothingToPayoutError extends DomainError { constructor(ambassadorId: string) { super('NOTHING_TO_PAYOUT', `Ambassador ${ambassadorId} has no unpaid earnings`, 409, { ambassadorId }); } }
export class InvalidReferralError extends DomainError { constructor(detail: string) { super('REFERRAL_INVALID', detail, 422, { detail }); } }
export class AmbassadorsForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('AMBASSADORS_FORBIDDEN', detail, 403, {}); } }
/** The caller is not an active ambassador — only an active ambassador may assist-onboard / log visits. */
export class NotAnAmbassadorError extends DomainError { constructor() { super('NOT_AN_AMBASSADOR', 'You must be an active ambassador to perform this action', 403, {}); } }
/** Assisted onboarding REQUIRES the farmer's recorded consent (DPDP) — refuse to create an account without it. */
export class ConsentRequiredError extends DomainError { constructor() { super('CONSENT_REQUIRED', 'Assisted onboarding requires the farmer to grant the data-processing consent', 422, {}); } }
/** A target for this ambassador + metric + period already exists (UNIQUE(ambassador_id, metric, period_start)). */
export class DuplicateTargetError extends DomainError { constructor() { super('TARGET_EXISTS', 'A target for this metric + period already exists', 409, {}); } }
