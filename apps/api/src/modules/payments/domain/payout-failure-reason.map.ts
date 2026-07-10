// modules/payments/domain/payout-failure-reason.map.ts · KV-BL-023 (screens 442/516).
// `payouts.failure_code` is a FREE VARCHAR the gateway hands back (RazorpayX `error.code`, sandbox
// `account_invalid`, design-canon placeholders `UPI_TIMEOUT`/`INSUFFICIENT_FUNDS`/`BANK_DECLINED` — confirmed
// by grep, no fixed enum/vocabulary exists: 03_API_CONTRACT_DELTA.md §payouts, SCREEN-DATA-CATALOG.md ~line
// 9366). That string is UNBOUNDED and provider-owned — never safe to localize 1:1 (a new/unrecognized provider
// code must never crash or silently leak raw gateway English to a farmer). This pure function buckets any raw
// code into a SMALL, stable, code-owned vocabulary that mirrors the lookup_values seeded in
// db/seeds/core/0014_payout_failure_reasons.sql — every bucket returned here has a matching lookup_values row.
// Case/format-insensitive (providers are inconsistent: 'UPI_TIMEOUT' vs 'account_invalid' vs 'rejected').
// Never throws; unrecognized/null codes fall into the 'other' bucket (the bank_rejected/other catch-all —
// covers both a genuine unmapped bank-side rejection and a wholly unknown/future provider code alike).
export type PayoutFailureReasonBucket = 'insufficient_funds' | 'invalid_account' | 'bank_declined' | 'timeout' | 'other';

export const PAYOUT_FAILURE_REASON_FALLBACK: PayoutFailureReasonBucket = 'other';

const BUCKETS: Readonly<Record<Exclude<PayoutFailureReasonBucket, 'other'>, readonly string[]>> = Object.freeze({
  insufficient_funds: ['insufficient_funds', 'insufficient_balance', 'low_balance'],
  invalid_account:    ['invalid_account', 'account_invalid', 'ifsc_invalid', 'beneficiary_invalid', 'invalid_ifsc'],
  bank_declined:      ['bank_declined', 'rejected', 'declined', 'account_blocked', 'account_frozen'],
  timeout:            ['upi_timeout', 'timeout', 'gateway_timeout', 'request_timeout'],
});

/** Normalize a raw provider code for matching: lower-case, non-alphanumerics → '_'. */
function normalize(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Map a raw `payouts.failure_code` (nullable — a success/queued/processing payout has none) to a stable
 *  internal bucket. Always returns a bucket that has a corresponding lookup_values row (never the raw code). */
export function mapProviderFailureCode(rawCode: string | null | undefined): PayoutFailureReasonBucket {
  if (!rawCode) return PAYOUT_FAILURE_REASON_FALLBACK;
  const n = normalize(rawCode);
  if (!n) return PAYOUT_FAILURE_REASON_FALLBACK;
  for (const [bucket, aliases] of Object.entries(BUCKETS) as [Exclude<PayoutFailureReasonBucket, 'other'>, readonly string[]][]) {
    if (aliases.includes(n)) return bucket;
  }
  return PAYOUT_FAILURE_REASON_FALLBACK;
}
