// modules/promotions/__tests__/promotion.service.spec.ts · pure-domain unit tests: promotion validity
// (Law 5), rules parsing, the discount math (percent/flat/min/cap), budget guard, and coupon caps. The
// service's UoW/outbox/atomic-redeem are covered by the integration spec.
import { derivePromotionStatus, isRedeemable } from '../domain/promotion.state';
import { Promotion, parsePromoRules } from '../domain/promotion.entity';
import { Coupon } from '../domain/coupon.entity';
import { PromotionEventType } from '../domain/promotions.events';
import { InvalidPromotionError, PromotionBudgetExceededError, CouponExhaustedError } from '../domain/promotions.errors';

const NOW = new Date('2026-06-01T00:00:00Z');
const window = { startsAt: new Date('2026-05-01T00:00:00Z'), endsAt: new Date('2026-12-31T00:00:00Z') };
const rules = (over: any = {}) => parsePromoRules({ discountType: 'percent', percentOff: 10, ...over });
const promo = (over: any = {}) => Promotion.create({ id: 'p1', tenantId: 't1', promoType: 'festival', defaultName: 'Diwali', rules: rules(over.rules), budgetMinor: over.budgetMinor ?? null, startsAt: over.startsAt ?? window.startsAt, endsAt: over.endsAt ?? window.endsAt, now: NOW });

describe('promotion.state', () => {
  it('derives status from is_active + window + budget', () => {
    const base = { isActive: true, startsAt: window.startsAt, endsAt: window.endsAt, budgetMinor: null as bigint | null, spentMinor: 0n };
    expect(derivePromotionStatus(base, NOW)).toBe('active');
    expect(derivePromotionStatus({ ...base, isActive: false }, NOW)).toBe('paused');
    expect(derivePromotionStatus(base, new Date('2026-01-01T00:00:00Z'))).toBe('scheduled');
    expect(derivePromotionStatus(base, new Date('2027-01-01T00:00:00Z'))).toBe('expired');
    expect(derivePromotionStatus({ ...base, budgetMinor: 1000n, spentMinor: 1000n }, NOW)).toBe('exhausted');
    expect(isRedeemable(base, NOW)).toBe(true);
  });
});

describe('parsePromoRules', () => {
  it('rejects bad shapes and parses percent/flat', () => {
    expect(() => parsePromoRules({ discountType: 'bogus' })).toThrow(InvalidPromotionError);
    expect(() => parsePromoRules({ discountType: 'percent', percentOff: 0 })).toThrow(InvalidPromotionError);
    expect(() => parsePromoRules({ discountType: 'percent', percentOff: 101 })).toThrow(InvalidPromotionError);
    expect(() => parsePromoRules({ discountType: 'flat' })).toThrow(InvalidPromotionError);
    expect(() => parsePromoRules({ discountType: 'flat', amountOffMinor: '0' })).toThrow(InvalidPromotionError);
    expect(parsePromoRules({ discountType: 'percent', percentOff: 15, maxDiscountMinor: '5000' }).maxDiscountMinor).toBe(5000n);
    expect(parsePromoRules({ discountType: 'flat', amountOffMinor: '2500' }).amountOffMinor).toBe(2500n);
  });
});

describe('Promotion.create + computeDiscount', () => {
  it('rejects an inverted window, empty name, negative budget', () => {
    expect(() => promo({ endsAt: window.startsAt })).toThrow(InvalidPromotionError);
    expect(() => Promotion.create({ id: 'p', tenantId: 't', promoType: 'festival', defaultName: '  ', rules: rules(), startsAt: window.startsAt, endsAt: window.endsAt })).toThrow(InvalidPromotionError);
    expect(() => promo({ budgetMinor: -1n })).toThrow(InvalidPromotionError);
  });
  it('emits created + starts active', () => {
    const p = promo();
    expect(p.status(NOW)).toBe('active');
    expect(p.pullEvents().map((e) => e.type)).toContain(PromotionEventType.PromotionCreated);
  });
  it('percent discount honours cap, min-order floor, and never exceeds subtotal', () => {
    expect(promo({ rules: { percentOff: 10 } }).computeDiscount(100000n)).toBe(10000n);             // 10%
    expect(promo({ rules: { percentOff: 50, maxDiscountMinor: '5000' } }).computeDiscount(100000n)).toBe(5000n);  // capped
    expect(promo({ rules: { percentOff: 10, minOrderMinor: '200000' } }).computeDiscount(100000n)).toBe(0n);      // below min
    const flat = Promotion.create({ id: 'p2', tenantId: 't1', promoType: 'festival', defaultName: 'Flat', rules: parsePromoRules({ discountType: 'flat', amountOffMinor: '999999' }), startsAt: window.startsAt, endsAt: window.endsAt, now: NOW });
    expect(flat.computeDiscount(50000n)).toBe(50000n);                                              // clamped to subtotal
  });
  it('recordSpend enforces the budget (fail closed) and signals exhaustion', () => {
    const p = promo({ budgetMinor: 10000n }); p.pullEvents();
    p.recordSpend(6000n); expect(p.spentMinor).toBe(6000n);
    expect(() => p.recordSpend(5000n)).toThrow(PromotionBudgetExceededError);   // 6000+5000 > 10000
    p.recordSpend(4000n);                                                        // exactly to budget
    expect(p.pullEvents().map((e) => e.type)).toContain(PromotionEventType.BudgetExhausted);
  });
});

describe('Coupon', () => {
  it('normalizes/validates the code + caps; consumeUse fails closed at max', () => {
    expect(() => Coupon.create({ id: 'c', tenantId: 't', promotionId: 'p', code: 'ab' })).toThrow(InvalidPromotionError);
    expect(() => Coupon.create({ id: 'c', tenantId: 't', promotionId: 'p', code: 'OK', perUserLimit: 0 })).toThrow(InvalidPromotionError);
    const c = Coupon.create({ id: 'c', tenantId: 't', promotionId: 'p', code: 'diwali10', maxUses: 1 });
    expect(c.code).toBe('DIWALI10');
    c.consumeUse();
    expect(() => c.consumeUse()).toThrow(CouponExhaustedError);
  });
});
