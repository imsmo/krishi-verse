// Unit tests for the PURE listing-links helpers — proves no fabrication (missing token/id → null) and that
// the auction CTA's "live" flag matches the auction lifecycle.
import { traceHref, auctionCta, listingLinks } from '../features/listing/links';

describe('traceHref', () => {
  it('returns null for missing/blank token (no fabricated /trace link)', () => {
    expect(traceHref(null)).toBeNull();
    expect(traceHref(undefined)).toBeNull();
    expect(traceHref('')).toBeNull();
    expect(traceHref('   ')).toBeNull();
  });
  it('builds an encoded provenance href', () => {
    expect(traceHref('QR_abc123')).toBe('/trace/QR_abc123');
    expect(traceHref('a/b c')).toBe('/trace/a%2Fb%20c');
  });
});

describe('auctionCta', () => {
  it('returns null when not auctioned', () => {
    expect(auctionCta(null, null)).toBeNull();
    expect(auctionCta(undefined, 'live')).toBeNull();
    expect(auctionCta('  ', 'live')).toBeNull();
  });
  it('marks live for biddable statuses', () => {
    for (const s of ['scheduled', 'live', 'extended', 'awaiting_approval']) {
      expect(auctionCta('au1', s)).toEqual({ href: '/auctions/au1', live: true });
    }
  });
  it('marks NOT live for terminal statuses', () => {
    for (const s of ['ended', 'settled', 'cancelled', 'failed_reserve', undefined, null]) {
      expect(auctionCta('au1', s as string | null)).toEqual({ href: '/auctions/au1', live: false });
    }
  });
  it('encodes the auction id', () => {
    expect(auctionCta('a/1', 'live')?.href).toBe('/auctions/a%2F1');
  });
});

describe('listingLinks', () => {
  it('derives both from a detail-read card', () => {
    expect(listingLinks({ qrToken: 'QR1', auctionId: 'au9', auctionStatus: 'live' }))
      .toEqual({ trace: '/trace/QR1', auction: { href: '/auctions/au9', live: true } });
  });
  it('yields nulls when the card carries no links', () => {
    expect(listingLinks({ qrToken: null, auctionId: null, auctionStatus: null }))
      .toEqual({ trace: null, auction: null });
  });
});
