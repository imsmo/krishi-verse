// modules/payments/domain/commission.errors.ts · typed errors for settlement pricing.
import { DomainError } from '../../../shared/errors/app-error';

/** No commission rule resolved for the order (platform default missing) — fail closed, don't settle. */
export class NoCommissionRuleError extends DomainError {
  constructor(details: Record<string, unknown>) { super('NO_COMMISSION_RULE', 'No commission rule applies to this order', 500, details); }
}
/** The resolved rules would leave the seller a negative net — misconfigured rates. Fail closed. */
export class SettlementConfigError extends DomainError {
  constructor(details: Record<string, unknown>) { super('SETTLEMENT_CONFIG_INVALID', 'Settlement rates exceed the gross amount', 500, details); }
}
/** A commission-rule catalog entry failed its invariants (rates out of range, bad window). */
export class InvalidCommissionRuleError extends DomainError {
  constructor(message: string) { super('COMMISSION_RULE_INVALID', message, 422); }
}
/** A tax-rule value object failed validation (rate out of range, split inconsistent). */
export class InvalidTaxRuleError extends DomainError {
  constructor(message: string) { super('TAX_RULE_INVALID', message, 422); }
}
/** A charge-definition config is malformed for its calc_method. Fail closed. */
export class InvalidChargeDefinitionError extends DomainError {
  constructor(message: string) { super('CHARGE_DEFINITION_INVALID', message, 422); }
}
/** Managing the PLATFORM-default rule catalog (tenant_id NULL) is god-mode (admin-api) — refused here. */
export class CommissionRuleForbiddenError extends DomainError {
  constructor(message = 'platform-default commission rules are managed in admin-api') { super('COMMISSION_RULE_FORBIDDEN', message, 403); }
}
export class CommissionRuleNotFoundError extends DomainError {
  constructor(id: string) { super('COMMISSION_RULE_NOT_FOUND', 'Commission rule not found', 404, { id }); }
}
