// Unit tests for the PURE wallet-hub presenters (screen 19): month bucket, pending sum, ledger kind, recent slice.
import { currentYearMonth, monthBucketMinor, pendingPayoutMinor, ledgerKind, recentLedger } from '../../features/wallet/wallet-home';

describe('currentYearMonth', () => {
  it('formats YYYY-MM (UTC)', () => {
    expect(currentYearMonth(new Date('2026-06-30T23:00:00Z'))).toBe('2026-06');
    expect(currentYearMonth(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01');
  });
});

describe('monthBucketMinor', () => {
  const by = [{ key: '2026-05', amountMinor: '1000000', count: 3 }, { key: '2026-06', amountMinor: '1892000', count: 5 }];
  it('returns the matching month total', () => {
    expect(monthBucketMinor(by, '2026-06')).toBe('1892000');
  });
  it('returns 0 for an absent month / empty input (never fabricated)', () => {
    expect(monthBucketMinor(by, '2026-04')).toBe('0');
    expect(monthBucketMinor(undefined, '2026-06')).toBe('0');
  });
});

describe('pendingPayoutMinor', () => {
  it('sums only in-flight payouts (BigInt, skips settled/failed)', () => {
    const out = pendingPayoutMinor([
      { id: 'a', status: 'pending', amountMinor: '200000', currencyCode: 'INR' },
      { id: 'b', status: 'processing', amountMinor: '40000', currencyCode: 'INR' },
      { id: 'c', status: 'paid', amountMinor: '999999', currencyCode: 'INR' },
      { id: 'd', status: 'failed', amountMinor: '500', currencyCode: 'INR' },
    ]);
    expect(out).toBe('240000');
  });
  it('is 0 with no pending payouts; tolerates a malformed amount', () => {
    expect(pendingPayoutMinor([])).toBe('0');
    expect(pendingPayoutMinor([{ id: 'x', status: 'pending', amountMinor: 'NaN', currencyCode: 'INR' }])).toBe('0');
  });
});

describe('ledgerKind', () => {
  it('credit → in, plain debit → out, reservation debit → hold', () => {
    expect(ledgerKind({ amountMinor: '125000', txnType: 'order_settlement' })).toBe('in');
    expect(ledgerKind({ amountMinor: '-490000', txnType: 'wage_payout' })).toBe('out');
    expect(ledgerKind({ amountMinor: '-50000', txnType: 'emd_hold' })).toBe('hold');
    expect(ledgerKind({ amountMinor: '-50000', txnType: 'auction_escrow' })).toBe('hold');
  });
  it('zero → in; malformed amount → in (never throws)', () => {
    expect(ledgerKind({ amountMinor: '0', txnType: null })).toBe('in');
    expect(ledgerKind({ amountMinor: 'x', txnType: 'emd_hold' })).toBe('in');
  });
});

describe('recentLedger', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ entryId: String(i) } as any));
  it('takes the first n (newest-first server order)', () => {
    expect(recentLedger(mk(9), 5)).toHaveLength(5);
    expect(recentLedger(mk(3), 5)).toHaveLength(3);
  });
});
