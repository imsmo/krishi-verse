// modules/payments/domain/billing.errors.ts · typed errors for statements/invoices.
import { AppError, NotFoundError } from '../../../shared/errors/app-error';

/** No un-statemented settlement lines for the seller in the period — nothing to bill. */
export class NoSettlementLinesError extends AppError {
  constructor(details: Record<string, unknown>) { super('NO_SETTLEMENT_LINES', 'No settlements to statement for this seller/period', 409, details); }
}
export class StatementNotFoundError extends NotFoundError { constructor() { super('Settlement statement not found'); } }
export class InvoiceNotFoundError extends NotFoundError { constructor() { super('Trade invoice not found'); } }
