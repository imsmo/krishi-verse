// apps/mobile/src/core/payments/money.ts · PURE money helpers for the payment flows. Amounts are bigint minor
// units (paise) as strings end-to-end (Law 2) — these helpers convert at the UI edge (whole rupees the user
// types ↔ paise) using BigInt only, never a float. Also classifies a server payment status into a terminal
// outcome the UI can act on. Dependency-free → unit-tested.

/** Whole-rupees string → paise minor-unit string. Returns null if not a positive integer rupee amount within
 * a sane cap (₹2,00,000 — tune per risk policy; the server re-validates limits regardless). */
export function rupeesToPaiseMinor(rupees: string, maxRupees = 200000): string | null {
  const clean = rupees.trim();
  if (!/^\d{1,7}$/.test(clean)) return null;
  const r = BigInt(clean);
  if (r <= 0n || r > BigInt(maxRupees)) return null;
  return (r * 100n).toString();
}

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

/** True when a payment intent was created against the deterministic SANDBOX gateway — i.e. no real PSP
 * (Razorpay) is configured server-side (apps/api's payments.module.ts registers the sandbox gateway,
 * and only ever registers it as the DEFAULT when Razorpay isn't configured, which is itself only
 * possible outside production). The add-money screen uses this to drive the server's dev-only sandbox
 * completion instead of opening a real gateway checkout sheet with a fake gateway order id it would
 * never recognise (that call would just throw — see checkout.ts). Pure string check → unit-tested. */
export function isSandboxProvider(provider: string | undefined | null): boolean {
  return provider === 'sandbox';
}
