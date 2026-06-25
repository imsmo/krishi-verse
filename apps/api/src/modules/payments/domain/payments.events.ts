// modules/payments/domain/payments.events.ts · integration events (via outbox, Law 4).
export const PaymentEventType = {
  Initiated: 'payments.payment_initiated',
  Succeeded: 'payments.payment_succeeded',   // orders consumes this → order.markPaid
  Failed: 'payments.payment_failed',
  Refunded: 'payments.payment_refunded',
} as const;
export type PaymentEventType = typeof PaymentEventType[keyof typeof PaymentEventType];

export const MandateEventType = {
  Registered: 'payments.mandate_registered',   // user created a pending autopay mandate (awaiting PSP confirm)
  Activated: 'payments.mandate_activated',      // PSP confirmed the standing instruction
  Cancelled: 'payments.mandate_cancelled',      // user (or system) revoked it
} as const;
export type MandateEventType = typeof MandateEventType[keyof typeof MandateEventType];

export type DomainEvent = { type: string; payload: Record<string, unknown> };
