// apps/mobile/src/features/buyer/saved-set.ts · PURE set/list helpers for the buyer's on-device "saved" lists
// (listings, sellers, searches). No imports → unit-tested. Keeps the lists deduped, capped (bounded memory/
// storage — guide §5), and most-recent-first. The data layer persists the result; these functions own the logic.

/** Toggle an id in a string set: add to the FRONT if absent, remove if present. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}

export function isSaved(ids: string[], id: string): boolean {
  return ids.includes(id);
}

/** Keep at most `max` items (drops the oldest = the tail). */
export function capList<T>(list: T[], max: number): T[] {
  return list.length <= max ? list : list.slice(0, max);
}

/** Dedupe by a key, keeping the FIRST occurrence (most-recent-first ordering preserved). */
export function dedupeBy<T>(list: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k); out.push(item);
  }
  return out;
}

/** Upsert an object to the front (most-recent-first), deduped by key and capped. Used for saved searches/sellers/
 * listing snapshots where we store more than just an id. */
export function upsertFront<T>(list: T[], item: T, keyOf: (item: T) => string, max: number): T[] {
  return capList(dedupeBy([item, ...list], keyOf), max);
}
