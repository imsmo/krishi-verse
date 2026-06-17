// modules/payments/domain/payments.events.ts · integration events (via outbox, Law 4).
export const PaymentEventType = {
  Initiated: 'payments.payment_initiated',
  Succeeded: 'payments.payment_succeeded',   // orders consumes this → order.markPaid
  Failed: 'payments.payment_failed',
  Refunded: 'payments.payment_refunded',
} as const;
export type PaymentEventType = typeof PaymentEventType[keyof typeof PaymentEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };
