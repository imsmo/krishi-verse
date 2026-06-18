// modules/tenancy/domain/tenancy.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class PlanNotFoundError extends NotFoundError { constructor(id: string) { super('Plan not found'); (this as any).details = { id }; } }
export class SubscriptionNotFoundError extends NotFoundError { constructor(id: string) { super('Subscription not found'); (this as any).details = { id }; } }
/** Managing the global plan catalogue is platform-admin only (god-mode, Law 11). */
export class PlanForbiddenError extends AppError { constructor(message = 'Plan management requires platform admin') { super('PLAN_FORBIDDEN', message, 403); } }
export class SubscriptionForbiddenError extends AppError { constructor(message = 'Not allowed on this subscription') { super('SUBSCRIPTION_FORBIDDEN', message, 403); } }
export class InvalidPlanError extends DomainError { constructor(message: string) { super('PLAN_INVALID', message, 400); } }
export class InvalidSubscriptionError extends DomainError { constructor(message: string) { super('SUBSCRIPTION_INVALID', message, 400); } }
/** The chosen plan is inactive / not subscribable. */
export class PlanNotSubscribableError extends AppError { constructor() { super('PLAN_NOT_SUBSCRIBABLE', 'Plan is not available for subscription', 409); } }
/** The tenant already has a live subscription — change the plan or cancel first. */
export class AlreadySubscribedError extends AppError { constructor() { super('ALREADY_SUBSCRIBED', 'This tenant already has a live subscription', 409); } }
/** Code uniqueness (code, version, country). */
export class PlanCodeExistsError extends AppError { constructor() { super('PLAN_CODE_EXISTS', 'A plan with this code/version/country already exists', 409); } }
export class SubscriptionNotLiveError extends AppError { constructor(status: string) { super('SUBSCRIPTION_NOT_LIVE', `Subscription is not live (status: ${status})`, 409, { status }); } }
