// modules/search/domain/search.rank.ts · PURE cross-entity merge + rank + federated-cursor codec (no I/O →
// unit-tested). The unified search fans a free-text query across several per-entity indices (listings, products,
// …); each index returns its own hits (recency-sorted by the engine). This module merges them into ONE ranked
// list and encodes a composite cursor (a per-type opaque cursor map) so "load more" re-queries each index from
// where it left off — there is no single global keyset across heterogeneous indices, so we federate honestly.
// Ranking is deterministic: stronger text match first (exact > prefix > substring > none), then most-recent.
// Regexes are avoided; matching is plain string ops (ReDoS-safe).

export const SEARCH_TYPES = ['listings', 'products'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface RawHit { type: SearchType; id: string; title: string; createdAt: string; ref?: Record<string, unknown>; }
export interface RankedHit extends RawHit { score: number; }

/** Parse a `types` csv against the allowed set; empty/invalid ⇒ all types (never throws). */
export function parseTypes(csv?: string): SearchType[] {
  if (!csv || !csv.trim()) return [...SEARCH_TYPES];
  const want = new Set(csv.split(',').map((s) => s.trim().toLowerCase()));
  const picked = SEARCH_TYPES.filter((t) => want.has(t));
  return picked.length ? picked : [...SEARCH_TYPES];
}

export function clampLimit(n: number | undefined, def = 20, max = 50): number {
  if (!Number.isFinite(n as number)) return def;
  return Math.max(1, Math.min(Math.trunc(n as number), max));
}

/** Text-match strength of a title against the query (0..3). Case/space-insensitive, plain string ops. */
export function titleMatchScore(title: string, text: string): number {
  const t = (title ?? '').trim().toLowerCase();
  const q = (text ?? '').trim().toLowerCase();
  if (!q || !t) return 0;
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

/** Merge per-type hit groups into one deterministically-ranked list (match strength desc, then recency desc,
 *  then type+id for a stable tiebreak). Caps the merged output. */
export function rankHits(groups: Array<{ type: SearchType; hits: RawHit[] }>, text: string, limit: number): RankedHit[] {
  const all: RankedHit[] = [];
  for (const g of groups) for (const h of g.hits) {
    all.push({ ...h, type: g.type, score: titleMatchScore(h.title, text) });
  }
  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = Date.parse(a.createdAt) || 0, bt = Date.parse(b.createdAt) || 0;
    if (bt !== at) return bt - at;
    return (a.type + a.id < b.type + b.id) ? -1 : (a.type + a.id > b.type + b.id) ? 1 : 0;
  });
  return all.slice(0, clampLimit(limit));
}

// --- federated cursor: an opaque base64 of a per-type cursor map ({ listings: '…', products: '…' }). ---
export function encodeSearchCursor(perType: Partial<Record<SearchType, string>>): string | undefined {
  const entries = Object.entries(perType).filter(([, v]) => !!v);
  if (entries.length === 0) return undefined;
  return Buffer.from(JSON.stringify(Object.fromEntries(entries))).toString('base64url');
}

export function decodeSearchCursor(cursor?: string): Partial<Record<SearchType, string>> {
  if (!cursor) return {};
  try {
    const o = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const out: Partial<Record<SearchType, string>> = {};
    for (const t of SEARCH_TYPES) if (typeof o?.[t] === 'string') out[t] = o[t];
    return out;
  } catch {
    return {};
  }
}
