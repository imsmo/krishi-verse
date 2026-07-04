// modules/payments/domain/payments.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class PaymentNotFoundError extends NotFoundError {
  constructor(id: string) { super('Payment not found'); (this as any).details = { id }; }
}
/** Webhook signature failed verification — treat as hostile, never trust the payload. */
export class WebhookSignatureError extends AppError {
  constructor() { super('PAYMENT_WEBHOOK_BAD_SIGNATURE', 'Invalid webhook signature', 401); }
}
/** Webhook amount disagrees with the recorded intent — possible tampering. */
export class PaymentAmountMismatchError extends AppError {
  constructor(expected: bigint, got: bigint) { super('PAYMENT_AMOUNT_MISMATCH', 'Webhook amount does not match the payment', 409, { expected: expected.toString(), got: got.toString() }); }
}
export class PaymentCurrencyMismatchError extends AppError {
  constructor(expected: string, got: string) { super('PAYMENT_CURRENCY_MISMATCH', 'Webhook currency does not match the payment', 409, { expected, got }); }
}
export class PaymentConcurrencyError extends AppError {
  constructor(id: string) { super('PAYMENT_CONCURRENCY', 'Payment was modified concurrently; retry', 409, { id }); }
}
export class RefundExceedsPaymentError extends DomainError {
  constructor() { super('REFUND_EXCEEDS_PAYMENT', 'Refund amount exceeds the refundable balance', 409); }
}
export class PaymentForbiddenError extends AppError {
  constructor(message = 'Not allowed on this payment') { super('PAYMENT_FORBIDDEN', message, 403); }
}
/** Pay-from-wallet fails closed when the buyer's spendable balance can't cover the order in full. */
export class InsufficientWalletBalanceError extends DomainError {
  constructor(required: bigint, available: bigint) {
    super('WALLET_INSUFFICIENT_BALANCE', 'Wallet balance is less than the amount required', 422, { requiredMinor: required.toString(), availableMinor: available.toString() });
  }
}

/** A batch row was not found in the caller's scope (404, never 403 — no enumeration). */
export class PayoutBatchNotFoundError extends NotFoundError {
  constructor(id: string) { super('Payout batch not found'); (this as any).details = { id }; }
}
/** The payout referenced by an async gateway callback could not be located (unknown gateway id). */
export class PayoutNotFoundError extends NotFoundError {
  constructor(ref: string) { super('Payout not found'); (this as any).details = { ref }; }
}
/** A payout webhook signature failed verification — treat as hostile, never trust the payload. */
export class PayoutWebhookSignatureError extends AppError {
  constructor() { super('PAYOUT_WEBHOOK_BAD_SIGNATURE', 'Invalid payout webhook signature', 401); }
}

/** A UPI autopay mandate was not found in the caller's scope (404, never 403 — no enumeration). */
export class MandateNotFoundError extends NotFoundError {
  constructor(id: string) { super('Mandate not found'); (this as any).details = { id }; }
}
/** The caller already holds a live (pending/active/paused) mandate for this purpose. */
export class MandateAlreadyExistsError extends AppError {
  constructor(purpose: string) { super('MANDATE_ALREADY_EXISTS', 'A live autopay mandate already exists for this purpose', 409, { purpose }); }
}
/** A submitted VPA failed the handle@psp shape check — never store/parse an unvalidated VPA. */
export class InvalidVpaError extends DomainError {
  constructor() { super('MANDATE_INVALID_VPA', 'VPA must look like handle@psp', 422); }
}
/** A debit was attempted against a mandate that is not active (pending/cancelled/expired). */
export class MandateNotActiveError extends DomainError {
  constructor(status: string) { super('MANDATE_NOT_ACTIVE', `Mandate is ${status}, not active — cannot collect`, 409, { status }); }
}
/** A requested collection exceeded the mandate's authorised per-debit cap (honour the user's ceiling). */
export class MandateAmountExceedsCapError extends DomainError {
  constructor(amountMinor: bigint, capMinor: bigint) {
    super('MANDATE_AMOUNT_OVER_CAP', 'Collection exceeds the mandate per-debit cap', 422, { amountMinor: amountMinor.toString(), capMinor: capMinor.toString() });
  }
}
/** AutoPay execution is behind the `autopay_execution` flag (default OFF until a live UPI-AutoPay PSP is wired). */
export class MandateExecutionDisabledError extends AppError {
  constructor() { super('MANDATE_EXECUTION_DISABLED', 'UPI AutoPay execution is not enabled', 403); }
}
