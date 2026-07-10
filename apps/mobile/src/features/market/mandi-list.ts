// apps/mobile/src/features/market/mandi-list.ts · PURE helpers for the "Today's Mandi Prices" list (screen 52).
// No React / no SDK — small derivations over the server's MandiPrice[] rows used by the screen + its unit tests.
// P1-3: the price read-model now carries the commodity CATEGORY (categoryName), so the category chips are built
// from the REAL distinct categories present in the loaded rows (never a hard-coded taxonomy) and filter live.
// These helpers only surface what the rows actually contain (latest date, region/yard header, categories).

export interface PriceRow { priceDate: string; regionName?: string | null; categoryName?: string | null }

/** Distinct, non-empty commodity categories present in the rows (sorted) — the dynamic filter chips beyond "All".
 * Pure; returns real catalogue names only, never a guessed taxonomy. */
export function distinctCategories(rows: readonly { categoryName?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const r of rows) { const c = (r.categoryName ?? '').trim(); if (c) set.add(c); }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Filter rows by a selected category name; the sentinel 'all' (or empty) returns every row. Pure. */
export function filterByCategory<T extends { categoryName?: string | null }>(rows: readonly T[], category: string): T[] {
  if (!category || category === 'all') return [...rows];
  return rows.filter((r) => (r.categoryName ?? '') === category);
}

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
