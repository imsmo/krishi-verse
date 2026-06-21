// Unit tests for the PURE auction logic (features/auctions/auction-status). No React/native deps (SDK/ui types are
// type-only). Money is bigint minor strings (Law 2) — current price / min-next / bid validation use BigInt.
import { auctionStatusTone, isBiddable, currentPriceMinor, minNextBidMinor, validateBidRupees, isOutbid } from '../../features/auctions/auction-status';
import type { BidHistoryItem } from '@krishi-verse/sdk-js';

const bid = (over: Partial<BidHistoryItem>): BidHistoryItem => ({ id: 'b', bidderUserId: 'u', amountMinor: '10000', createdAt: '2026-06-01T00:00:00Z', ...over });

describe('auctionStatusTone / isBiddable', () => {
  it('maps status → tone and biddability', () => {
    expect(auctionStatusTone('live')).toBe('success');
    expect(auctionStatusTone('scheduled')).toBe('info');
    expect(auctionStatusTone('settled')).toBe('accent');
    expect(auctionStatusTone('failed_reserve')).toBe('danger');
    expect(isBiddable('live')).toBe(true);
    expect(isBiddable('extended')).toBe(true);
    expect(isBiddable('ended')).toBe(false);
    expect(isBiddable('scheduled')).toBe(false);
  });
});

describe('currentPriceMinor', () => {
  it('returns the highest visible bid, ignoring masked (null) amounts', () => {
    const bids = [bid({ amountMinor: '15000' }), bid({ amountMinor: null }), bid({ amountMinor: '12000' })];
    expect(currentPriceMinor({ startPriceMinor: '10000' }, bids)).toBe('15000');
  });
  it('falls back to the start price when there are no visible bids', () => {
    expect(currentPriceMinor({ startPriceMinor: '10000' }, [])).toBe('10000');
    expect(currentPriceMinor({ startPriceMinor: '10000' }, [bid({ amountMinor: null })])).toBe('10000');
  });
  it('never returns below the start price', () => {
    expect(currentPriceMinor({ startPriceMinor: '10000' }, [bid({ amountMinor: '5000' })])).toBe('10000');
  });
  it('handles very large amounts without float loss', () => {
    expect(currentPriceMinor({ startPriceMinor: '1' }, [bid({ amountMinor: '9007199254740993000' })])).toBe('9007199254740993000');
  });
});

describe('minNextBidMinor', () => {
  it('adds the increment (bigint)', () => {
    expect(minNextBidMinor('15000', '500')).toBe('15500');
  });
});

describe('validateBidRupees', () => {
  it('accepts a bid ≥ the minimum next bid', () => {
    expect(validateBidRupees('200', '15500')).toEqual({ ok: true }); // 200₹ = 20000 ≥ 15500
  });
  it('rejects a bid below the minimum', () => {
    expect(validateBidRupees('150', '15500')).toEqual({ ok: false, reason: 'too_low' }); // 15000 < 15500
  });
  it('rejects non-integer / empty input', () => {
    expect(validateBidRupees('12.5', '100')).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBidRupees('', '100')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('isOutbid', () => {
  it('true when I have bid but the top visible bid is someone else', () => {
    const bids = [bid({ bidderUserId: 'other', amountMinor: '20000' }), bid({ bidderUserId: 'me', amountMinor: '15000' })];
    expect(isOutbid(bids, 'me')).toBe(true);
  });
  it('false when I am the top bidder', () => {
    const bids = [bid({ bidderUserId: 'me', amountMinor: '20000' }), bid({ bidderUserId: 'other', amountMinor: '15000' })];
    expect(isOutbid(bids, 'me')).toBe(false);
  });
  it('false when I have not bid at all', () => {
    expect(isOutbid([bid({ bidderUserId: 'other' })], 'me')).toBe(false);
  });
});
