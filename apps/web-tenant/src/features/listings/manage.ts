// apps/web-tenant/src/features/listings/manage.ts · PURE helpers for the owner listing-detail page. They mirror
// the API's listing state machine (db/migrations/0005 + listings/domain/listing.state.ts) so the console only
// OFFERS legal actions — but the API is always the authority and re-checks every transition (we reflect, never
// grant; an illegal/raced action degrades to a message). No framework, no I/O → unit-tested.

export const LISTING_STATUSES = [
  'draft', 'pending_approval', 'published', 'paused', 'sold_out', 'expired', 'rejected', 'hidden', 'archived',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// Statuses from which a transition to 'published' is legal (publish button surfaces only for these).
const PUBLISHABLE_FROM: ReadonlySet<string> = new Set(['draft', 'pending_approval', 'paused', 'sold_out', 'expired', 'hidden']);

/** Can the owner attempt to publish from this status? (Server re-validates the transition.) */
export function canPublish(status: string | undefined | null): boolean {
  return !!status && PUBLISHABLE_FROM.has(status);
}

/** Can the owner attempt a price change? Allowed unless the listing is archived (terminal). */
export function canChangePrice(status: string | undefined | null): boolean {
  return status !== 'archived';
}

/** Map an SDK error code from changePrice to a UI reason key (optimistic-concurrency conflict vs generic). */
export function priceErrorKey(code: string | undefined): 'conflict' | 'failed' {
  const c = (code ?? '').toUpperCase();
  return c.includes('VERSION') || c.includes('CONFLICT') || c === '409' ? 'conflict' : 'failed';
}
