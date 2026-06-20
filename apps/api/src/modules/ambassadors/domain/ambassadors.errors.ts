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
