// Unit tests for the PURE My-Listings logic (screen 12): badge mapping, status counts, filter, countdown.
import { badgeFor, countByStatus, filterListings, auctionCountdown, cropEmoji, LISTING_FILTERS } from '../../features/listings/my-listings';

const L = (over: Partial<{ status: string; auctionId: string | null; auctionStatus: string | null; id: string }>) =>
  ({ id: over.id ?? 'x', status: over.status ?? 'active', auctionId: over.auctionId ?? null, auctionStatus: over.auctionStatus ?? null } as any);

describe('badgeFor', () => {
  it('auction wins over status', () => {
    expect(badgeFor(L({ status: 'active', auctionId: 'a1', auctionStatus: 'live' }))).toBe('auction');
  });
  it('maps status → badge', () => {
    expect(badgeFor(L({ status: 'active' }))).toBe('live');
    expect(badgeFor(L({ status: 'published' }))).toBe('live');
    expect(badgeFor(L({ status: 'sold' }))).toBe('sold');
    expect(badgeFor(L({ status: 'draft' }))).toBe('draft');
  });
  it('an ended/absent auction falls back to plain status', () => {
    expect(badgeFor(L({ status: 'active', auctionId: 'a1', auctionStatus: 'ended' }))).toBe('live');
  });
});

describe('countByStatus + filter', () => {
  const items = [L({ status: 'active' }), L({ status: 'active', auctionId: 'a', auctionStatus: 'live' }), L({ status: 'sold' }), L({ status: 'draft' })];
  it('counts buckets', () => {
    expect(countByStatus(items)).toEqual({ all: 4, active: 2, sold: 1, draft: 1 });
  });
  it('filters client-side', () => {
    expect(filterListings(items, 'all').length).toBe(4);
    expect(filterListings(items, 'active').length).toBe(2);
    expect(filterListings(items, 'sold').length).toBe(1);
    expect(filterListings(items, 'draft').length).toBe(1);
  });
  it('exposes the design filter set', () => {
    expect([...LISTING_FILTERS]).toEqual(['all', 'active', 'sold', 'draft']);
  });

  // KV-MF-07 regression: Home's "My Listings N Active" stat must use this SAME helper (countByStatus().active)
  // as the My Listings screen — never a raw items.length. Reproduces the reported mismatch: an owner box of 7
  // rows (6 live + 1 draft) must count 6 active, not 7 (the draft is not "active").
  it('KV-MF-07: 6 live + 1 draft ⇒ active=6, never 7 (draft excluded from "active")', () => {
    const sevenItems = [
      L({ status: 'active' }), L({ status: 'active' }), L({ status: 'active' }),
      L({ status: 'published' }), L({ status: 'published' }),
      L({ status: 'active', auctionId: 'a', auctionStatus: 'live' }),
      L({ status: 'draft' }),
    ];
    const counts = countByStatus(sevenItems);
    expect(counts.all).toBe(7);
    expect(counts.active).toBe(6);
    expect(counts.draft).toBe(1);
  });
});

describe('auctionCountdown', () => {
  const now = Date.parse('2026-06-30T10:00:00Z');
  it('formats d/h/m/s and nulls when ended/absent', () => {
    expect(auctionCountdown('2026-06-30T12:00:00Z', now)).toBe('2h');
    expect(auctionCountdown('2026-06-30T10:45:00Z', now)).toBe('45m');
    expect(auctionCountdown('2026-07-02T10:00:00Z', now)).toBe('2d');
    expect(auctionCountdown('2026-06-30T09:59:30Z', now)).toBeNull(); // ended
    expect(auctionCountdown(null, now)).toBeNull();
    expect(auctionCountdown('not-a-date', now)).toBeNull();
  });
});

describe('cropEmoji', () => {
  it('maps known crops + defaults', () => {
    expect(cropEmoji('Premium Wheat — Lokwan')).toBe('🌾');
    expect(cropEmoji('Red Chilli')).toBe('🌶️');
    expect(cropEmoji('Onion')).toBe('🧅');
    expect(cropEmoji('Something else')).toBe('🌾');
  });
});
