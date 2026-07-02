// apps/mobile/src/features/market/mandi-detail.ts · PURE helpers for the commodity price detail (screen 53). No
// React / no SDK — derivations over the server's MandiPulse (latest + history) and the cross-yard price rows.
// All money is BigInt minor-unit strings (Law 2); the trend/summary/change come straight from real history rows,
// never fabricated. Distances use the shared haversine via the screen (lat/lng injected here as plain numbers).

export interface HistoryRow { priceDate: string; modalMinor: string }
export type TrendPeriod = '1W' | '1M' | '3M' | '6M' | '1Y';
export const TREND_PERIODS: TrendPeriod[] = ['1W', '1M', '3M', '6M', '1Y'];
const PERIOD_DAYS: Record<TrendPeriod, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

function big(v: string): bigint { try { return BigInt(v); } catch { return 0n; } }

/** History sorted newest-first (does not mutate input). Pure. */
export function sortedDesc(history: readonly HistoryRow[]): HistoryRow[] {
  return [...history].sort((a, b) => new Date(b.priceDate).getTime() - new Date(a.priceDate).getTime());
}

/** The modal of the most recent row strictly BEFORE `latestIso` (the prior day's price), or null. Pure. */
export function previousModalMinor(history: readonly HistoryRow[], latestIso: string): string | null {
  const t = new Date(latestIso).getTime();
  let best: HistoryRow | null = null;
  for (const r of history) {
    const rt = new Date(r.priceDate).getTime();
    if (Number.isNaN(rt) || rt >= t) continue;
    if (!best || rt > new Date(best.priceDate).getTime()) best = r;
  }
  return best ? best.modalMinor : null;
}

/** Day-over-day change: signed delta (BigInt minor) + integer percent vs the prior price. null when there's no
 * prior price or it's 0 (can't compute %). Pure. */
export function priceChange(latestMinor: string, prevMinor: string | null): { deltaMinor: string; pct: number } | null {
  if (prevMinor === null) return null;
  const prev = big(prevMinor); if (prev === 0n) return null;
  const delta = big(latestMinor) - prev;
  return { deltaMinor: delta.toString(), pct: Number((delta * 100n) / (prev < 0n ? -prev : prev)) };
}

export type Volatility = 'low' | 'medium' | 'high';
export interface SummaryStats { highMinor: string; lowMinor: string; avgMinor: string; volatility: Volatility; count: number }
/** High / low / average (BigInt minor) and a volatility bucket over the last `days` of history. Volatility =
 * (high−low)/avg → <8% low, <20% medium, else high. Empty history → zeros + 'low'. Pure. */
export function summaryStats(history: readonly HistoryRow[], days = 30, nowMs: number = Date.now()): SummaryStats {
  const cutoff = nowMs - days * 86_400_000;
  const rows = history.filter((r) => { const t = new Date(r.priceDate).getTime(); return !Number.isNaN(t) && t >= cutoff; });
  if (rows.length === 0) return { highMinor: '0', lowMinor: '0', avgMinor: '0', volatility: 'low', count: 0 };
  let hi = big(rows[0].modalMinor), lo = big(rows[0].modalMinor), sum = 0n;
  for (const r of rows) { const v = big(r.modalMinor); if (v > hi) hi = v; if (v < lo) lo = v; sum += v; }
  const avg = sum / BigInt(rows.length);
  let volatility: Volatility = 'low';
  if (avg > 0n) {
    const spreadPct = Number(((hi - lo) * 100n) / avg);
    volatility = spreadPct < 8 ? 'low' : spreadPct < 20 ? 'medium' : 'high';
  }
  return { highMinor: hi.toString(), lowMinor: lo.toString(), avgMinor: avg.toString(), volatility, count: rows.length };
}

export interface TrendBar { dateIso: string; modalMinor: string; heightPct: number }
/** History within the period window as normalized bars (0–100, tallest = 100), oldest→newest. Pure. */
export function trendSeries(history: readonly HistoryRow[], period: TrendPeriod, nowMs: number = Date.now()): TrendBar[] {
  const cutoff = nowMs - PERIOD_DAYS[period] * 86_400_000;
  const rows = history
    .filter((r) => { const t = new Date(r.priceDate).getTime(); return !Number.isNaN(t) && t >= cutoff; })
    .sort((a, b) => new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime());
  let max = 0n; for (const r of rows) { const v = big(r.modalMinor); if (v > max) max = v; }
  return rows.map((r) => ({ dateIso: r.priceDate, modalMinor: r.modalMinor, heightPct: max > 0n ? Number((big(r.modalMinor) * 100n) / max) : 0 }));
}

/** The modal price of the most recent history row dated on/before `targetMs`, or null. Powers period-over-period
 * change (e.g. "this week" = latest vs the price ~7 days ago). Pure. */
export function modalOnOrBefore(history: readonly HistoryRow[], targetMs: number): string | null {
  let best: HistoryRow | null = null;
  for (const r of history) {
    const t = new Date(r.priceDate).getTime();
    if (Number.isNaN(t) || t > targetMs) continue;
    if (!best || t > new Date(best.priceDate).getTime()) best = r;
  }
  return best ? best.modalMinor : null;
}

/** History within the last `days` as normalized bars (0–100, tallest = 100), oldest→newest. Pure. */
export function trendByDays(history: readonly HistoryRow[], days: number, nowMs: number = Date.now()): TrendBar[] {
  const cutoff = nowMs - days * 86_400_000;
  const rows = history
    .filter((r) => { const t = new Date(r.priceDate).getTime(); return !Number.isNaN(t) && t >= cutoff; })
    .sort((a, b) => new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime());
  let max = 0n; for (const r of rows) { const v = big(r.modalMinor); if (v > max) max = v; }
  return rows.map((r) => ({ dateIso: r.priceDate, modalMinor: r.modalMinor, heightPct: max > 0n ? Number((big(r.modalMinor) * 100n) / max) : 0 }));
}

export interface NearbyInput { mandiId: string | null; modalMinor: string }
export interface MandiMeta { id: string; name: string; distanceKm: number | null }
export interface NearbyRow { mandiId: string; name: string; modalMinor: string; distanceKm: number | null }
/** Join cross-yard price rows to mandi metadata (name + precomputed distanceKm), sorted nearest-first
 * (unknown distance last). Rows without a resolvable mandi are dropped (degrade, never blank). Pure. */
export function nearbyMandiPrices(prices: readonly NearbyInput[], mandis: readonly MandiMeta[]): NearbyRow[] {
  const byId = new Map(mandis.map((m) => [m.id, m]));
  const rows: NearbyRow[] = [];
  for (const p of prices) {
    if (!p.mandiId) continue;
    const m = byId.get(p.mandiId);
    if (!m) continue;
    rows.push({ mandiId: p.mandiId, name: m.name, modalMinor: p.modalMinor, distanceKm: m.distanceKm });
  }
  return rows.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

/** The highest-priced nearby yard (best for a seller) or null. Pure. */
export function bestNearby(rows: readonly NearbyRow[]): NearbyRow | null {
  let best: NearbyRow | null = null;
  for (const r of rows) if (!best || big(r.modalMinor) > big(best.modalMinor)) best = r;
  return best;
}
