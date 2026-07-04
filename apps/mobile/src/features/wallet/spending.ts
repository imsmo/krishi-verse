// apps/mobile/src/features/wallet/spending.ts · PURE spending-insights math for screen 182. No React/SDK — just
// aggregation over the server's WalletInsights.byType buckets ({key, amountMinor, count}). Money is BigInt
// minor-unit strings (Law 2); percentages are derived integers (never floats persisted). The category KEY is the
// server's txn-type code — we never fabricate a category the server didn't return.
import type { Bucket } from './earnings';

function big(v: string): bigint { try { return BigInt(v); } catch { return 0n; } }

export interface CategorySlice { key: string; amountMinor: string; pct: number }

/** By-category breakdown from the server's byType buckets: each slice's share of the total (integer %), sorted
 * high→low. Total ≤ 0 → all 0%. Pure — no float persisted. */
export function categoryBreakdown(byType: readonly Bucket[], totalMinor: string): CategorySlice[] {
  const total = big(totalMinor);
  return [...(byType ?? [])]
    .sort((a, b) => { const x = big(a.amountMinor), y = big(b.amountMinor); return x < y ? 1 : x > y ? -1 : 0; })
    .map((b) => ({ key: b.key, amountMinor: b.amountMinor, pct: total > 0n ? Number((big(b.amountMinor) * 100n) / total) : 0 }));
}

/** A per-category glyph, matched from the txn-type code (substring). Unknown → the generic "other" icon. Display
 * only — a wrong match falls back to 📋, never asserts a category the data doesn't have. Pure. */
export function spendingIcon(key: string | null | undefined): string {
  const k = (key ?? '').toLowerCase();
  if (/wage|labou?r/.test(k)) return '👷';
  if (/input|seed|fertil|pesticid/.test(k)) return '💊';
  if (/transport|logistic|delivery|freight/.test(k)) return '🚛';
  if (/boost|promot|ad/.test(k)) return '🚀';
  return '📋';
}
