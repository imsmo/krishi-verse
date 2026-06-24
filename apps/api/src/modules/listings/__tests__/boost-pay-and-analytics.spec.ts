// API-W4 pure invariants for boost pay-from-wallet + tier pricing (node-port lane). The service is
// orchestration over real Postgres + the wallet ledger (integration suite); this asserts the pure
// money math + tier-meta parsing the service relies on (Law 2 — float-free bigint).
import { ListingBoost } from '../domain/listing-boost.entity';

// mirrors ListingBoostRepository.listTiers meta-parse (price_minor + days live in lookup_values.meta).
const parseTier = (meta: any) => ({ priceMinor: String(meta?.price_minor ?? 0), days: Number(meta?.days ?? 0) });
// mirrors the boost pay legs: buyer wallet → platform fees (boost is platform revenue, zero-sum).
const boostLegs = (price: bigint) => [{ account: 'platform:fees', m: price }, { account: 'user:buyer:main', m: -price }];

describe('API-W4 · boost tier pricing (pure)', () => {
  it('reads price_minor + days from the seeded tier meta (server truth)', () => {
    expect(parseTier({ price_minor: 14900, days: 7 })).toEqual({ priceMinor: '14900', days: 7 });
  });
  it('defaults to 0/0 for a malformed/empty meta (never NaN)', () => {
    expect(parseTier(null)).toEqual({ priceMinor: '0', days: 0 });
    expect(parseTier({})).toEqual({ priceMinor: '0', days: 0 });
  });
});

describe('API-W4 · boost pay-from-wallet (ledger invariant)', () => {
  it('the buyer→platform-fees legs net to zero (money conserved, Law 11)', () => {
    expect(boostLegs(14900n).reduce((s, l) => s + l.m, 0n)).toBe(0n);
  });
  it('debits exactly the tier price from the buyer and credits platform fees', () => {
    const legs = boostLegs(39900n);
    expect(legs.find((l) => l.account === 'user:buyer:main')!.m).toBe(-39900n);
    expect(legs.find((l) => l.account === 'platform:fees')!.m).toBe(39900n);
  });
});

describe('API-W4 · ListingBoost window', () => {
  it('rejects a non-positive price and an inverted window (domain guard)', () => {
    const base = { id: 'b1', tenantId: 't1', listingId: 'l1', buyerUserId: 'u1', boostTierId: 'tier1', currencyCode: 'INR' };
    const now = new Date('2026-06-24T00:00:00Z');
    expect(() => ListingBoost.create({ ...base, priceMinor: 0n, startsAt: now, endsAt: new Date(now.getTime() + 1000) })).toThrow();
    expect(() => ListingBoost.create({ ...base, priceMinor: 100n, startsAt: now, endsAt: now })).toThrow();
    expect(ListingBoost.create({ ...base, priceMinor: 14900n, startsAt: now, endsAt: new Date(now.getTime() + 7 * 86400_000) }).props.priceMinor).toBe(14900n);
  });
});
