// apps/web-storefront/src/features/payments/status.ts · PURE classification of a server payment status into a
// terminal outcome the checkout UI can act on. Mirrors the mobile app's money.ts mapping so web + mobile agree on
// what "paid" means. No I/O, no framework, no money math → trivially testable. The server's signed webhook is the
// authority; the client only READS status and maps it here.
export type PaymentOutcome = 'success' | 'failed' | 'pending';

const SUCCESS = new Set(['captured', 'succeeded', 'paid', 'settled', 'success']);
const FAILED = new Set(['failed', 'cancelled', 'canceled', 'expired', 'voided']);

/** Map a server payment status string to a terminal outcome (anything else = still pending). */
export function paymentOutcome(status: string | undefined | null): PaymentOutcome {
  const s = (status ?? '').toLowerCase();
  if (SUCCESS.has(s)) return 'success';
  if (FAILED.has(s)) return 'failed';
  return 'pending';
}

export function isTerminal(status: string | undefined | null): boolean {
  return paymentOutcome(status) !== 'pending';
}
