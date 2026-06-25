// modules/payments/domain/billing.errors.ts · typed errors for statements/invoices.
import { AppError, NotFoundError } from '../../../shared/errors/app-error';

/** No un-statemented settlement lines for the seller in the period — nothing to bill. */
export class NoSettlementLinesError extends AppError {
  constructor(details: Record<string, unknown>) { super('NO_SETTLEMENT_LINES', 'No settlements to statement for this seller/period', 409, details); }
}
export class StatementNotFoundError extends NotFoundError { constructor() { super('Settlement statement not found'); } }
export class InvoiceNotFoundError extends NotFoundError { constructor() { super('Trade invoice not found'); } }
/** The invoice exists but its PDF isn't available yet (renderer disabled, or scan not yet clean). Retryable. */
export class InvoicePdfNotReadyError extends AppError { constructor() { super('INVOICE_PDF_NOT_READY', 'Invoice PDF is not available yet', 409); } }
/** A trade invoice failed its domain invariants (totals/GST split malformed). */
export class InvalidTradeInvoiceError extends AppError { constructor(message: string) { super('TRADE_INVOICE_INVALID', message, 422); } }
