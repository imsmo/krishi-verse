// modules/promotions/__tests__/promotion-lifecycle.spec.ts · pure-domain tests for the W4-01 worker-job
// lifecycle helpers: recordSpend(enforce vs backstop), isBudgetExhausted, isWithinWindow. The jobs +
// PromotionService system methods + RLS are covered by the module integration spec.
import { Promotion } from '../domain/promotion.entity';
import { PromotionEventType } from '../domain/promotions.events';
import { PromotionBudgetExceededError } from '../domain/promotions.errors';

const rules = { discountType: 'flat' as const, percentOff: null, amountOffMinor: 100n, minOrderMinor: null, maxDiscountMinor: null };
function promo(over: Partial<Parameters<typeof Promotion.create>[0]> = {}) {
  return Promotion.create({ id: 'p1', tenantId: 't1', promoType: 'festival', defaultName: 'Diwali', rules,
    budgetMinor: 1000n, startsAt: new Date('2026-04-01T00:00:00Z'), endsAt: new Date('2026-04-10T00:00:00Z'), ...over });
}

describe('Promotion lifecycle helpers (W4-01)', () => {
  it('recordSpend fails CLOSED past budget by default, but the backstop variant never throws', () => {
    expect(() => promo().recordSpend(2000n)).toThrow(PromotionBudgetExceededError);
    const p = promo(); p.pullEvents();
    expect(() => p.recordSpend(2000n, { enforceBudget: false })).not.toThrow();
    expect(p.spentMinor).toBe(2000n);
    expect(p.isBudgetExhausted()).toBe(true);
    expect(p.pullEvents().map((e) => e.type)).toContain(PromotionEventType.BudgetExhausted);   // still flags for the budget-watch
  });
  it('isBudgetExhausted is false below budget and false when budget is null (uncapped)', () => {
    expect(promo().isBudgetExhausted()).toBe(false);
    expect(promo({ budgetMinor: null }).isBudgetExhausted()).toBe(false);
  });
  it('isWithinWindow brackets the [starts_at, ends_at] window (festival-scheduler predicate)', () => {
    const p = promo();
    expect(p.isWithinWindow(new Date('2026-04-05T00:00:00Z'))).toBe(true);
    expect(p.isWithinWindow(new Date('2026-03-31T00:00:00Z'))).toBe(false);
    expect(p.isWithinWindow(new Date('2026-04-11T00:00:00Z'))).toBe(false);
  });
});
