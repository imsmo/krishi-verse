// modules/listings/domain/listing.state.ts
// THE listing state machine. The ONLY place status transitions are defined
// (CLAUDE.md Law 5). Pure TS, zero framework imports, 100% branch-tested.
import { IllegalListingTransitionError } from './listing.errors';

export const LISTING_STATUSES = [
  'draft', 'pending_approval', 'published', 'paused',
  'sold_out', 'expired', 'rejected', 'hidden', 'archived',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Allowed transitions. Anything not listed is rejected by the database of truth. */
const TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = Object.freeze({
  draft:            ['pending_approval', 'published', 'archived'],
  pending_approval: ['published', 'rejected', 'draft'],
  published:        ['paused', 'sold_out', 'expired', 'hidden', 'archived'],
  paused:           ['published', 'archived'],
  rejected:         ['draft', 'archived'],
  sold_out:         ['archived', 'published'], // re-list after restock
  expired:          ['published', 'archived'],
  hidden:           ['published', 'archived'],
  archived:         [],
});

/** Terminal statuses cannot transition out (except as listed). */
export const TERMINAL_STATUSES: ReadonlySet<ListingStatus> = new Set(['archived']);

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: ListingStatus, to: ListingStatus): void {
  if (!canTransition(from, to)) throw new IllegalListingTransitionError(from, to);
}
export function allowedNext(from: ListingStatus): readonly ListingStatus[] {
  return TRANSITIONS[from] ?? [];
}
/** Statuses a buyer can transact against. */
export function isPurchasable(status: ListingStatus): boolean {
  return status === 'published';
}
