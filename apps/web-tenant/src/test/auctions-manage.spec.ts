// apps/web-tenant/src/test/auctions-manage.spec.ts · unit tests for the auction action gating + create-payload
// assembly. Gating mirrors the API state machine; create validation is the first gate before the authed action.
import { canApprove, canCancel, buildCreateAuction } from '../features/auctions/manage';

describe('canApprove', () => {
  it('only while awaiting_approval', () => {
    expect(canApprove('awaiting_approval')).toBe(true);
    for (const s of ['scheduled', 'live', 'ended', 'settled', 'cancelled', '', undefined, null]) expect(canApprove(s as string)).toBe(false);
  });
});

describe('canCancel', () => {
  it('before ended/settled', () => {
    for (const s of ['scheduled', 'live', 'extended', 'awaiting_approval']) expect(canCancel(s)).toBe(true);
    for (const s of ['ended', 'settled', 'cancelled', 'failed_reserve']) expect(canCancel(s)).toBe(false);
  });
});

describe('buildCreateAuction', () => {
  const base = { listingId: 'L1', startPriceMajor: '100', startsAtIso: '2026-07-01T10:00:00.000Z', endsAtIso: '2026-07-02T10:00:00.000Z' };

  it('assembles a valid payload (money → minor, default kind)', () => {
    const r = buildCreateAuction(base);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toMatchObject({ listingId: 'L1', kind: 'english_open', startPriceMinor: '10000' });
  });
  it('carries optional money + sealed kind + approval flag', () => {
    const r = buildCreateAuction({ ...base, kind: 'sealed', reservePriceMajor: '150', minIncrementMajor: '5', emdMajor: '20', requiresSellerApproval: 'on' });
    expect(r.ok && r.value).toMatchObject({ kind: 'sealed', reservePriceMinor: '15000', minIncrementMinor: '500', emdMinor: '2000', requiresSellerApproval: true });
  });
  it('rejects bad listing / price / window', () => {
    expect(buildCreateAuction({ ...base, listingId: '' })).toEqual({ ok: false, error: 'listing' });
    expect(buildCreateAuction({ ...base, startPriceMajor: '0' })).toEqual({ ok: false, error: 'startPrice' });
    expect(buildCreateAuction({ ...base, endsAtIso: base.startsAtIso })).toEqual({ ok: false, error: 'window' });
    expect(buildCreateAuction({ ...base, startsAtIso: 'nope' })).toEqual({ ok: false, error: 'window' });
  });
  it('rejects a malformed optional increment', () => {
    expect(buildCreateAuction({ ...base, minIncrementMajor: '0' })).toEqual({ ok: false, error: 'increment' });
  });
});
