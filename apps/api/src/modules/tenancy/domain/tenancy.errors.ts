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

// ---- tenancy self-serve (profile / domains / settings) ----
export class TenantNotFoundError extends NotFoundError { constructor(id: string) { super('Tenant not found'); (this as any).details = { id }; } }
/** The actor lacks tenant.settings on this tenant. */
export class TenantForbiddenError extends AppError { constructor(message = 'Tenant administration requires tenant.settings') { super('TENANT_FORBIDDEN', message, 403); } }
export class InvalidTenantProfileError extends DomainError { constructor(message: string) { super('TENANT_PROFILE_INVALID', message, 422); } }
/** Self-serve writes refused because the tenant is suspended/archived/terminated (fail closed). */
export class TenantNotWritableError extends AppError { constructor(status: string) { super('TENANT_NOT_WRITABLE', `Tenant is not self-serve writable (status: ${status})`, 409, { status }); } }
/** submitForReview is only valid from 'pending'. */
export class TenantNotPendingError extends AppError { constructor(status: string) { super('TENANT_NOT_PENDING', `Tenant onboarding can only be submitted while pending (status: ${status})`, 409, { status }); } }
export class TenantDomainNotFoundError extends NotFoundError { constructor(id: string) { super('Tenant domain not found'); (this as any).details = { id }; } }
export class InvalidTenantDomainError extends DomainError { constructor(message: string) { super('TENANT_DOMAIN_INVALID', message, 422); } }
/** UNIQUE(domain) — already claimed (by this or another tenant). */
export class DomainExistsError extends AppError { constructor(domain: string) { super('TENANT_DOMAIN_EXISTS', `Domain ${domain} is already registered`, 409, { domain }); } }
export class UnknownSettingError extends NotFoundError { constructor(key: string) { super('Setting definition not found'); (this as any).details = { key }; } }
export class InvalidSettingError extends DomainError { constructor(key: string, message: string) { super('TENANT_SETTING_INVALID', `${key}: ${message}`, 422, { key }); } }
/** Only scope='tenant' settings are self-serve writable (platform/user-scoped keys refused — Law 11). */
export class SettingNotTenantScopedError extends AppError { constructor(key: string, scope: string) { super('SETTING_NOT_TENANT_SCOPED', `Setting ${key} is ${scope}-scoped and not tenant-editable`, 403, { key, scope }); } }
