// apps/web-tenant/src/test/offers-negotiation.spec.ts · unit tests for the offer-negotiation gating. The console
// must only surface accept/counter/reject while a negotiation is live; these pin that terminal/converted offers
// are read-only and that the effective price prefers the latest counter.
import { isNegotiable, isTerminal, effectivePriceMinor } from '../features/offers/negotiation';

describe('isNegotiable', () => {
  it('true only for open/countered', () => {
    expect(isNegotiable('open')).toBe(true);
    expect(isNegotiable('countered')).toBe(true);
    for (const s of ['accepted', 'rejected', 'expired', 'converted', '', undefined, null]) expect(isNegotiable(s as string)).toBe(false);
  });
});

describe('isTerminal', () => {
  it('true for rejected/expired/converted', () => {
    for (const s of ['rejected', 'expired', 'converted']) expect(isTerminal(s)).toBe(true);
    for (const s of ['open', 'countered', 'accepted']) expect(isTerminal(s)).toBe(false);
  });
});

describe('effectivePriceMinor', () => {
  it('prefers the latest counter, else the original offer', () => {
    expect(effectivePriceMinor({ offeredPriceMinor: '10000', counterPriceMinor: null })).toBe('10000');
    expect(effectivePriceMinor({ offeredPriceMinor: '10000', counterPriceMinor: '9500' })).toBe('9500');
  });
});
