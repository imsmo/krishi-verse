// apps/mobile/src/features/labour/book-confirm.ts · PURE logic for the booking wizard's Confirm & Pay step
// (screen 63). No React / no SDK I/O → unit-tested. Money is bigint paise (Law 2) — never a float. It decides
// wallet sufficiency and builds the HONEST cost breakdown: the wage the worker receives is real (from the draft);
// the platform fee has NO labour fee-preview contract, so it is shown as "applied at settlement" (never a
// fabricated ₹10/₹410 total); PMSBY insurance is a FREE public-program line. The payment method is the farmer's
// intended settlement route (wallet vs UPI-on-completion) — carried locally, flagged (createBooking has no
// paymentMethod field yet), and does NOT change that labour wages settle at completion via the escrow/payWages path.
export const PAYMENT_METHODS = ['wallet', 'upi'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** True when the wallet's available balance covers the committed wage. Pure bigint compare; a missing/blank balance
 * (wallet-service unreachable) → false (we don't claim sufficiency we can't prove). */
export function walletSufficient(availableMinor: string | null | undefined, requiredMinor: string | null | undefined): boolean {
  try {
    if (availableMinor == null || availableMinor === '' || requiredMinor == null || requiredMinor === '') return false;
    return BigInt(availableMinor) >= BigInt(requiredMinor);
  } catch { return false; }
}

export type FeeLineKind = 'amount' | 'free' | 'settlement';
export interface FeeLine { key: 'wage' | 'platformFee' | 'pmsby'; kind: FeeLineKind; minor?: string }

/** The cost lines for the confirm screen, in display order. Only the wage carries a real amount; the platform fee
 * is deferred to settlement (no client figure — never faked) and PMSBY is FREE. Pure. */
export function confirmFeeLines(wageMinor: string): FeeLine[] {
  const wage = /^\d+$/.test(wageMinor) ? wageMinor : '0';
  return [
    { key: 'wage', kind: 'amount', minor: wage },
    { key: 'platformFee', kind: 'settlement' },
    { key: 'pmsby', kind: 'free' },
  ];
}

/** The amount the farmer commits to pay the worker on completion — the wage (bigint paise). This is what the CTA
 * and the terms reference; a fee-inclusive "grand total" is intentionally NOT computed because the fee isn't on the
 * contract (§13). Pure. */
export function committedWageMinor(wageMinor: string): string {
  return /^\d+$/.test(wageMinor) ? wageMinor : '0';
}

/** A confirm step can submit only with a valid draft + an agreed terms + a chosen method. Pure. */
export function canConfirm(hasInput: boolean, agreed: boolean, method: PaymentMethod | null): boolean {
  return hasInput && agreed && (method === 'wallet' || method === 'upi');
}
