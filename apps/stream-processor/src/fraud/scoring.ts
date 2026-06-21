// apps/stream-processor/src/fraud/scoring.ts · PURE fraud heuristics. The fraud-signal consumer assembles a
// `FraudFeature` from the event + rolling counters (which it queries), then this scorer decides whether to emit
// a signal. Deterministic + side-effect-free so the rules are unit-tested and explainable (every contribution
// carries a reason — auditability, and these feed the human review queue, never an automated money action).
//
// Money is bigint MINOR units (Law 2): amounts arrive as STRING minor units in the event payload and are parsed
// to bigint here — never floated. Thresholds are bigint minor units too.

export interface FraudFeature {
  amountMinor: bigint;          // transaction value in minor units (0 if N/A)
  ordersInWindow: number;       // count of this actor's orders in the recent velocity window
  failedPaymentsInWindow: number;
  accountAgeDays: number;       // age of the acting account
  distinctDevicesInWindow: number;
}

export interface FraudThresholds {
  highValueMinor: bigint;       // single-txn value that is "high"
  velocityCount: number;        // orders in window that is "rapid"
  failedPaymentCount: number;   // failed payments in window that is suspicious
  newAccountDays: number;       // account younger than this is "new"
  maxDevices: number;           // more distinct devices than this in window is suspicious
  flagAt: number;               // total score at/above which we emit a signal (0..100)
}

export const DEFAULT_THRESHOLDS: FraudThresholds = {
  highValueMinor: 5_000_00n,    // ₹5,00,000 in paise
  velocityCount: 10,
  failedPaymentCount: 3,
  newAccountDays: 2,
  maxDevices: 4,
  flagAt: 60,
};

export interface FraudAssessment {
  score: number;                // 0..100 (clamped)
  reasons: string[];            // explainable contributions
  flagged: boolean;             // score >= flagAt
}

/** Parse a string-minor-units amount to bigint; non-numeric/negative → 0 (fail safe, never throw, never float). */
export function parseAmountMinor(v: unknown): bigint {
  if (typeof v !== 'string' || !/^\d{1,19}$/.test(v)) return 0n;
  try { return BigInt(v); } catch { return 0n; }
}

/** Score a feature vector. Each rule adds a weighted, explained contribution; total is clamped to 0..100. */
export function scoreEvent(f: FraudFeature, t: FraudThresholds = DEFAULT_THRESHOLDS): FraudAssessment {
  const reasons: string[] = [];
  let score = 0;

  if (f.amountMinor >= t.highValueMinor) { score += 35; reasons.push('high_value_transaction'); }
  if (f.ordersInWindow >= t.velocityCount) { score += 30; reasons.push('order_velocity'); }
  if (f.failedPaymentsInWindow >= t.failedPaymentCount) { score += 25; reasons.push('repeated_payment_failures'); }
  if (f.accountAgeDays < t.newAccountDays) { score += 15; reasons.push('new_account'); }
  if (f.distinctDevicesInWindow > t.maxDevices) { score += 20; reasons.push('many_devices'); }

  // a new account making a high-value purchase is the classic combination — compound it
  if (f.accountAgeDays < t.newAccountDays && f.amountMinor >= t.highValueMinor) {
    score += 15; reasons.push('new_account_high_value');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons, flagged: score >= t.flagAt };
}
