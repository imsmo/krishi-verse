// Unit tests for the PURE transaction/payout history presenters (screens 21 / 59).
import { filterLedger, ledgerTotals, groupLedgerByDay, payoutKind, groupPayoutsByMonth } from '../../features/wallet/txn-history';

const e = (over: Partial<any> = {}): any => ({
  entryId: Math.random().toString(36).slice(2), txnId: 't', txnType: 'order_settlement', accountCode: 'main',
  amountMinor: '125000', balanceAfterMinor: '0', currencyCode: 'INR', referenceType: null, referenceId: null,
  description: null, createdAt: '2026-08-15T10:42:00.000Z', ...over,
});

describe('filterLedger', () => {
  const rows = [
    e({ amountMinor: '125000', txnType: 'order_settlement' }),  // in
    e({ amountMinor: '-50000', txnType: 'emd_hold' }),          // escrow/hold
    e({ amountMinor: '-490000', txnType: 'wage_payout' }),      // out
    e({ amountMinor: '500000', txnType: 'wallet_recharge', createdAt: '2026-07-01T08:00:00.000Z' }), // in, last month
  ];
  const now = Date.parse('2026-08-15T12:00:00Z');
  it('in / out / escrow split by sign + type', () => {
    expect(filterLedger(rows, 'in', now).length).toBe(2);
    expect(filterLedger(rows, 'out', now).length).toBe(1);
    expect(filterLedger(rows, 'escrow', now).length).toBe(1);
  });
  it('month keeps only current-UTC-month entries', () => {
    expect(filterLedger(rows, 'month', now).length).toBe(3); // the July recharge is excluded
  });
  it('all is a passthrough', () => {
    expect(filterLedger(rows, 'all', now).length).toBe(4);
  });
});

describe('ledgerTotals', () => {
  it('sums in / out (magnitude) / net, excluding holds (BigInt)', () => {
    const rows = [e({ amountMinor: '125000', txnType: 'order_settlement' }), e({ amountMinor: '-490000', txnType: 'wage_payout' }), e({ amountMinor: '-50000', txnType: 'emd_hold' })];
    expect(ledgerTotals(rows)).toEqual({ inMinor: '125000', outMinor: '490000', netMinor: '-365000' });
  });
  it('empty → zeroes; malformed amount skipped', () => {
    expect(ledgerTotals([])).toEqual({ inMinor: '0', outMinor: '0', netMinor: '0' });
    expect(ledgerTotals([e({ amountMinor: 'NaN' })])).toEqual({ inMinor: '0', outMinor: '0', netMinor: '0' });
  });
});

describe('groupLedgerByDay', () => {
  const now = Date.parse('2026-08-15T12:00:00Z');
  it('labels today / yesterday / date and preserves order', () => {
    const rows = [e({ createdAt: '2026-08-15T10:00:00Z' }), e({ createdAt: '2026-08-14T18:30:00Z' }), e({ createdAt: '2026-08-10T09:00:00Z' })];
    const g = groupLedgerByDay(rows, now);
    expect(g.map((x) => x.label)).toEqual(['today', 'yesterday', 'date']);
    expect(g[0].items.length).toBe(1);
  });
});

describe('payoutKind', () => {
  it('maps server status', () => {
    expect(payoutKind('paid')).toBe('success');
    expect(payoutKind('processing')).toBe('pending');
    expect(payoutKind('failed')).toBe('failed');
  });
});

describe('groupPayoutsByMonth', () => {
  it('groups by YYYY-MM in server order', () => {
    const ps = [
      { id: 'a', status: 'paid', amountMinor: '1', currencyCode: 'INR', createdAt: '2026-08-14T00:00:00Z' },
      { id: 'b', status: 'paid', amountMinor: '1', currencyCode: 'INR', createdAt: '2026-08-11T00:00:00Z' },
      { id: 'c', status: 'failed', amountMinor: '1', currencyCode: 'INR', createdAt: '2026-07-28T00:00:00Z' },
    ] as any;
    const g = groupPayoutsByMonth(ps);
    expect(g.map((m) => m.key)).toEqual(['2026-08', '2026-07']);
    expect(g[0].items.length).toBe(2);
  });
});
