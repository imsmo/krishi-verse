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
export class PaymentConcurrencyError extends AppError {
  constructor(id: string) { super('PAYMENT_CONCURRENCY', 'Payment was modified concurrently; retry', 409, { id }); }
}
export class RefundExceedsPaymentError extends DomainError {
  constructor() { super('REFUND_EXCEEDS_PAYMENT', 'Refund amount exceeds the refundable balance', 409); }
}
export class PaymentForbiddenError extends AppError {
  constructor(message = 'Not allowed on this payment') { super('PAYMENT_FORBIDDEN', message, 403); }
}
