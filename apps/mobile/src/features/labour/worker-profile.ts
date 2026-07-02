// apps/mobile/src/features/labour/worker-profile.ts · PURE presenters for the worker profile (screen 25). No
// React/native deps (SDK types are `import type` → erased) → unit-tested. Derives display bits from the REAL,
// PII-minimised WorkerProfile + labour lookups; never fabricates a datum the contract doesn't carry.

/** Whole years on the platform from the worker's join date → the "N yrs on platform" stat. null when unknown or
 * a future date (never negative). Pure. */
export function workerYears(createdAtIso: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!createdAtIso) return null;
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return null;
  const years = Math.floor((nowMs - t) / (365.25 * 24 * 3600 * 1000));
  return years >= 0 ? years : null;
}

/** Resolve the worker's self-declared skill ids to their localized names via the labour lookups. Unknown ids are
 * dropped (never shown as a raw uuid). Order follows the caller's id list. Pure. */
export function skillLabels(skills: ReadonlyArray<{ id: string; name: string }>, ids: readonly string[] | undefined): string[] {
  if (!ids?.length) return [];
  const byId = new Map(skills.map((s) => [s.id, s.name]));
  return ids.map((id) => byId.get(id)).filter((n): n is string => !!n);
}

/** Resolve a region id to its localized name (screen 25 location line). null when the id is missing/unknown — the
 * screen then omits the location rather than showing an opaque id. Pure. */
export function regionName(regions: ReadonlyArray<{ id: string; name: string }>, id: string | null | undefined): string | null {
  if (!id) return null;
  return regions.find((r) => r.id === id)?.name ?? null;
}

/** Compact Indian-lakh label for a lifetime-earnings figure (profile stat, e.g. "₹0.97L", "₹1.2Cr", "₹8,450").
 * Money in is bigint minor units (Law 2); this is a DISPLAY compaction only (never persisted/round-tripped). '—'
 * on a bad/absent value. Pure. */
export function compactLakh(minor: string | null | undefined): string {
  if (minor == null) return '—';
  let rupees: number;
  try { rupees = Number(BigInt(minor)) / 100; } catch { return '—'; }
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(rupees % 10_000_000 === 0 ? 0 : 2)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)}L`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
