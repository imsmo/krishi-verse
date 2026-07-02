// apps/mobile/src/features/listings/listing-analytics.ts · PURE helpers for screen 115 (Listing Analytics).
// No I/O — unit-tested.
//
// What's REAL (from listings.analytics() → ListingAnalytics): total views, savedCount, offers, price-changes,
// boosts, publishedAt, any active boost, AND a per-UTC-day view series (viewsByDay, last 7 days). From those we
// derive an offer-conversion rate, a real "Views by day" chart series, and a THREE-stage funnel
// (Opened → Saved → Offered) — all computed only from real counts.
//
// FLAGGED GAPS (§13 — never fabricated): the design's 5-stage funnel also has "Search saw" (search-impression
// counts) and the screen shows a buyer-location breakdown. Neither is captured yet (no impression counter; a
// per-viewer geo split is also DPDP-sensitive), so the screen omits the search-impression stage and flags the
// locations section "coming soon" rather than inventing 412 / 57% figures.

/** Offer-conversion rate as a percentage (offers ÷ views), rounded to 1 dp. NOT money — a count ratio, so a number
 * is fine (no bigint needed). Null when there are no views yet (the screen shows "—" rather than 0% or NaN). */
export function convRate(offers: number, views: number): number | null {
  if (!Number.isFinite(offers) || !Number.isFinite(views) || views <= 0) return null;
  return Math.round((offers / views) * 1000) / 10;
}

export interface FunnelStage { id: string; labelKey: string; value: number; /** 0–100 bar width vs the top stage */ widthPct: number }

/** The buyer-journey funnel built ONLY from real counts: Opened (= total views) → Saved (= savedCount) →
 * Offered (= offers). Bar widths are relative to the top stage (Opened). The design's "Search saw" stage is
 * omitted — there is no search-impression counter yet (the screen flags that), never a fabricated bar. */
export function funnelFromAnalytics(input: { views: number; saved: number; offers: number }): FunnelStage[] {
  const views = clampCount(input.views);
  const saved = clampCount(input.saved);
  const offers = clampCount(input.offers);
  const top = Math.max(views, 1);
  return [
    { id: 'opened', labelKey: 'analytics.funnel.opened', value: views, widthPct: 100 },
    { id: 'saved', labelKey: 'analytics.funnel.saved', value: saved, widthPct: barWidth(saved, top) },
    { id: 'offered', labelKey: 'analytics.funnel.offered', value: offers, widthPct: barWidth(offers, top) },
  ];
}

export interface ViewsBar { /** YYYY-MM-DD (UTC) */ day: string; /** 0=Sun … 6=Sat */ dow: number; views: number; /** 0–100 vs the busiest day */ heightPct: number }

/** Build a fixed 7-day window ending on `todayMs` (UTC), filling each day's view count from the real series
 * (absent days = 0) and a relative bar height vs the busiest day. Pure; `todayMs` injected for tests. The design's
 * chart is exactly 7 columns — this guarantees 7 ordered buckets regardless of how sparse the real data is. */
export function viewsByDaySeries(points: { day: string; views: number }[], todayMs = Date.now()): ViewsBar[] {
  const byDay = new Map<string, number>();
  for (const p of points) if (p && typeof p.day === 'string') byDay.set(p.day.slice(0, 10), clampCount(p.views));
  const DAY = 86_400_000;
  const bars: ViewsBar[] = [];
  let max = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayMs - i * DAY);
    const key = d.toISOString().slice(0, 10);
    const views = byDay.get(key) ?? 0;
    if (views > max) max = views;
    bars.push({ day: key, dow: d.getUTCDay(), views, heightPct: 0 });
  }
  for (const b of bars) b.heightPct = max > 0 && b.views > 0 ? Math.max(6, Math.round((b.views / max) * 100)) : 0;
  return bars;
}

/** Bar width 0–100, with a small floor so a non-zero stage is still visible; exactly 0 stays 0. Pure. */
function barWidth(value: number, top: number): number {
  if (value <= 0) return 0;
  const pct = Math.round((value / top) * 100);
  return Math.min(100, Math.max(8, pct));
}

function clampCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
