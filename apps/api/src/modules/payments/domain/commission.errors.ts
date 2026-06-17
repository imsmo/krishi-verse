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
