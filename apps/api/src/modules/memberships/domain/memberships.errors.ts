// modules/memberships/domain/memberships.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class TierNotFoundError extends NotFoundError { constructor(id: string) { super('Membership tier not found'); (this as any).details = { id }; } }
export class MembershipNotFoundError extends NotFoundError { constructor(id: string) { super('Membership not found'); (this as any).details = { id }; } }
export class MembershipForbiddenError extends AppError { constructor(message = 'Not allowed on this membership') { super('MEMBERSHIP_FORBIDDEN', message, 403); } }
export class InvalidTierError extends DomainError { constructor(message: string) { super('MEMBERSHIP_TIER_INVALID', message, 400); } }
/** The chosen tier is inactive (paused) or the requested billing cycle has no price. */
export class TierCodeExistsError extends AppError { constructor() { super('TIER_CODE_EXISTS', 'A tier with this code already exists', 409); } }
export class TierNotSubscribableError extends AppError { constructor(message = 'Tier is not available for subscription') { super('TIER_NOT_SUBSCRIBABLE', message, 409, {}); } }
/** The user already has a live membership — cancel/let it lapse before subscribing again. */
export class AlreadySubscribedError extends AppError { constructor() { super('ALREADY_SUBSCRIBED', 'You already have an active membership', 409); } }
/** Acting on a terminal (cancelled/expired) membership. */
export class MembershipNotLiveError extends AppError { constructor(status: string) { super('MEMBERSHIP_NOT_LIVE', `Membership is not live (status: ${status})`, 409, { status }); } }
