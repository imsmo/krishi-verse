// apps/mobile/src/features/wallet/earnings.ts · PURE earnings-dashboard math for screen 58. No React / no SDK —
// just aggregation over the server's WalletInsights.byMonth buckets (each {key, amountMinor, count}). All money is
// BigInt minor-unit strings (Law 2); percentages are derived integers (never floats persisted). These power the
// hero total, month-over-month delta, sales count, average sale, best month, and the bar chart.

export interface Bucket { key: string; amountMinor: string; count: number }
export type EarningsPeriod = 'week' | 'month' | 'year' | 'lifetime';

function big(v: string): bigint { try { return BigInt(v); } catch { return 0n; } }

/** The most recent month bucket (the design's "this month") or null when there's no data. Pure. */
export function currentMonth(byMonth: readonly Bucket[]): Bucket | null {
  return byMonth.length ? byMonth[byMonth.length - 1] : null;
}

/** Month-over-month change of the last two buckets: signed delta (BigInt minor) + integer percent vs the prior
 * month. null when there aren't two months or the prior month is 0 (can't compute a %). Pure. */
export function momDelta(byMonth: readonly Bucket[]): { deltaMinor: string; pct: number } | null {
  if (byMonth.length < 2) return null;
  const cur = big(byMonth[byMonth.length - 1].amountMinor);
  const prev = big(byMonth[byMonth.length - 2].amountMinor);
  const delta = cur - prev;
  if (prev === 0n) return null;
  const pct = Number((delta * 100n) / (prev < 0n ? -prev : prev));
  return { deltaMinor: delta.toString(), pct };
}

/** Total sales (transaction count) across the buckets in the window. Pure. */
export function totalSales(byMonth: readonly Bucket[]): number {
  return byMonth.reduce((n, b) => n + (Number.isFinite(b.count) ? b.count : 0), 0);
}

/** Average sale value = total ÷ count, as BigInt minor (floored). '0' when there are no sales. Pure. */
export function averageSaleMinor(totalMinor: string, count: number): string {
  if (!count || count <= 0) return '0';
  return (big(totalMinor) / BigInt(count)).toString();
}

/** The highest-earning month bucket (amount + key), or null. Pure. */
export function bestMonth(byMonth: readonly Bucket[]): Bucket | null {
  let best: Bucket | null = null;
  for (const b of byMonth) if (!best || big(b.amountMinor) > big(best.amountMinor)) best = b;
  return best;
}

/** The total + sale-count for the selected period, derived from the monthly buckets the server returned.
 * month = the latest bucket; year/lifetime = the sum of all returned buckets (server window is bounded, so
 * lifetime is flagged `approximate`); week can't be isolated from monthly granularity, so it falls back to the
 * latest month and is flagged `approximate` (§13 — a daily read-model is the real path). Pure. */
export function periodTotal(byMonth: readonly Bucket[], period: EarningsPeriod): { amountMinor: string; count: number; approximate: boolean } {
  if (byMonth.length === 0) return { amountMinor: '0', count: 0, approximate: period === 'week' || period === 'lifetime' };
  if (period === 'month' || period === 'week') {
    const c = byMonth[byMonth.length - 1];
    return { amountMinor: c.amountMinor, count: c.count, approximate: period === 'week' };
  }
  // year / lifetime → sum all returned buckets
  let sum = 0n; let count = 0;
  for (const b of byMonth) { sum += big(b.amountMinor); count += Number.isFinite(b.count) ? b.count : 0; }
  return { amountMinor: sum.toString(), count, approximate: period === 'lifetime' };
}

/** Average monthly earnings over the trailing `n` months, as a bigint-minor string (Law 2 — BigInt, floored,
 * never a float). '0' when there are no buckets. Powers the worker earnings chart's "₹X avg" caption. Pure. */
export function trailingAverageMinor(byMonth: readonly Bucket[], n = 7): string {
  const slice = byMonth.slice(-n);
  if (slice.length === 0) return '0';
  let sum = 0n;
  for (const b of slice) sum += big(b.amountMinor);
  return (sum / BigInt(slice.length)).toString();
}

export interface BarDatum { key: string; amountMinor: string; heightPct: number }
/** The trailing `n` months as bars with a normalized height (0–100, tallest = 100). Empty/zero-max → all 0.
 * Pure — the screen just maps heightPct to a pixel height. */
export function barChart(byMonth: readonly Bucket[], n = 6): BarDatum[] {
  const slice = byMonth.slice(-n);
  let max = 0n;
  for (const b of slice) { const v = big(b.amountMinor); if (v > max) max = v; }
  return slice.map((b) => ({
    key: b.key,
    amountMinor: b.amountMinor,
    heightPct: max > 0n ? Number((big(b.amountMinor) * 100n) / max) : 0,
  }));
}

/** The {from,to} ISO window to request for a period. month = since the 1st of this month; year = trailing ~12mo;
 * lifetime = a wide trailing window (server bounds it); week = trailing 7 days. Pure (nowMs injectable). */
export function earningsWindow(period: EarningsPeriod, nowMs: number = Date.now()): { from?: string; to?: string } {
  const now = new Date(nowMs);
  const to = now.toISOString();
  if (period === 'month') return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), to };
  if (period === 'week') return { from: new Date(nowMs - 7 * 86_400_000).toISOString(), to };
  if (period === 'year') return { from: new Date(nowMs - 365 * 86_400_000).toISOString(), to };
  return { from: new Date(nowMs - 5 * 365 * 86_400_000).toISOString(), to }; // lifetime (server-bounded)
}
