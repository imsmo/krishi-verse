// apps/mobile/src/features/buyer/seller-profile.ts · PURE helpers for the buyer Seller Profile (screen 100). No
// React/native imports → unit-tested. Derives display bits from the real SellerPublicProfile contract; never
// fabricates a datum the contract doesn't carry.
/** Whole years the seller has been on the platform, from memberSince → the "N YRS ON KV" tag. null when there's no
 * membership date (the tag then hides rather than inventing tenure). Pure. */
export function yearsOnKv(memberSinceIso: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!memberSinceIso) return null;
  const t = new Date(memberSinceIso).getTime();
  if (Number.isNaN(t)) return null;
  const years = Math.floor((nowMs - t) / (365.25 * 24 * 3600 * 1000));
  return years >= 0 ? years : null;
}
