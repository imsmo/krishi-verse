// apps/mobile/src/features/market/mandi-list.ts · PURE helpers for the "Today's Mandi Prices" list (screen 52).
// No React / no SDK — small derivations over the server's MandiPrice[] rows used by the screen + its unit tests.
// NOTE (§13): the price read-model carries no commodity CATEGORY and no day-over-day CHANGE%, so the screen
// renders the category chips disabled and omits the change badge rather than fabricating either. These helpers
// only surface what the rows actually contain (latest date + the region/yard header).

export interface PriceRow { priceDate: string; regionName?: string | null }

/** The category chip codes the design shows. 'all' is the only one the current contract can satisfy; the rest are
 * rendered but disabled until the price read-model carries a category (§13). Pure constant. */
export const MANDI_CATEGORIES = ['all', 'grains', 'pulses', 'vegetables', 'spices', 'cash_crops'] as const;
export type MandiCategory = (typeof MANDI_CATEGORIES)[number];

/** The most recent priceDate across the rows (ISO string) or null when there are none — drives the
 * "Updated … ago" header. Pure. */
export function latestPriceDate(rows: readonly PriceRow[]): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    if (!r.priceDate) continue;
    if (latest === null || new Date(r.priceDate).getTime() > new Date(latest).getTime()) latest = r.priceDate;
  }
  return latest;
}

/** The first non-empty region name across the rows (the location header, e.g. "Anand APMC"). null when none. Pure. */
export function headerRegion(rows: readonly PriceRow[]): string | null {
  for (const r of rows) { const n = (r.regionName ?? '').trim(); if (n) return n; }
  return null;
}
