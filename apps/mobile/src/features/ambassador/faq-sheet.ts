// apps/mobile/src/features/ambassador/faq-sheet.ts · PURE logic for the Ambassador FAQ Cheat Sheet (screen 167).
// No React/native → unit-tested. The FAQ entries themselves are FIXED reference copy (a coaching cheat sheet that
// is identical for every ambassador and ships in the app so it works offline) → they live as i18n keys, not DB
// rows (guide "READ FIRST": fixed reference copy is UI chrome, not per-user data). This module owns only the
// stable CATALOG (id + category) + the pure category-count and search/filter derivations the screen renders.
//
// §13 (NOT faked): the catalog length is the REAL count shown in "All · N" (never the mockup's hardcoded "20" —
// we render as many entries as are actually authored). Categories are the real distinct set. Nothing here asserts
// a tenant-specific number (e.g. a platform-fee %) — that belongs to the charge config, not static copy.

export type FaqCategory = 'signup' | 'money' | 'safety' | 'trust';

export interface FaqCatalogEntry { id: string; category: FaqCategory }

/** The stable cheat-sheet catalog: id (→ i18n `amb.faq.<id>.q` / `.a`, optional `.script`) + its category.
 * Ordered as the design lists them. Adding/removing an entry updates every count with zero screen edits. */
export const FAQ_CATALOG: readonly FaqCatalogEntry[] = [
  { id: 'moneyAfterSelling', category: 'money' },
  { id: 'aadhaarSafe', category: 'safety' },
  { id: 'buyerNoPay', category: 'trust' },
  { id: 'platformFee', category: 'money' },
  { id: 'mandiCashDigital', category: 'trust' },
  { id: 'noInternet', category: 'signup' },
  { id: 'sellWithoutListing', category: 'signup' },
  { id: 'bankAccount', category: 'money' },
];

/** The category filter order shown in the chip row (after the leading "All"). */
export const FAQ_CATEGORIES: readonly FaqCategory[] = ['signup', 'money', 'safety', 'trust'];

/** Count of entries per category + the `all` total. Pure — drives the chip badges ("All · N", "Money · 3"). */
export function faqCategoryCounts(catalog: readonly FaqCatalogEntry[] = FAQ_CATALOG): Record<'all' | FaqCategory, number> {
  const out: Record<'all' | FaqCategory, number> = { all: catalog.length, signup: 0, money: 0, safety: 0, trust: 0 };
  for (const e of catalog) out[e.category] += 1;
  return out;
}

export interface ResolvedFaq { id: string; category: FaqCategory; q: string; a: string; script?: string }

/** Filter the (already i18n-resolved) FAQ list by category ('all' = no category filter) + a case-insensitive
 * substring query over the question + answer. Pure; preserves catalog order; trims + lowercases the query. */
export function filterFaqs(list: readonly ResolvedFaq[], category: 'all' | FaqCategory, query: string): ResolvedFaq[] {
  const q = (query ?? '').trim().toLowerCase();
  return list.filter((f) => {
    if (category !== 'all' && f.category !== category) return false;
    if (!q) return true;
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
  });
}
