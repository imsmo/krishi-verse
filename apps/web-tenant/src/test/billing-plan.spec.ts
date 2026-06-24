// apps/web-tenant/src/test/billing-plan.spec.ts · unit tests for the billing helpers: cycle price pick, usage/
// limits merge (unlimited when no cap), and the apply-form validation gate.
import { planPriceMinor, mergeUsageRows, buildApply } from '../features/billing/plan';

describe('planPriceMinor', () => {
  it('picks monthly or annual', () => {
    const p = { monthlyPriceMinor: '49900', annualPriceMinor: '499000' };
    expect(planPriceMinor(p, 'monthly')).toBe('49900');
    expect(planPriceMinor(p, 'annual')).toBe('499000');
  });
});

describe('mergeUsageRows', () => {
  it('unions keys, defaults used=0 and limit=null (unlimited)', () => {
    const rows = mergeUsageRows({ listings: '100', orders: '5000' }, { listings: '37' });
    expect(rows).toEqual([
      { key: 'listings', used: '37', limit: '100' },
      { key: 'orders', used: '0', limit: '5000' },
    ]);
  });
  it('limit null when only usage is present', () => {
    expect(mergeUsageRows(undefined, { staff: '3' })).toEqual([{ key: 'staff', used: '3', limit: null }]);
  });
  it('empty when both missing', () => {
    expect(mergeUsageRows()).toEqual([]);
  });
});

describe('buildApply', () => {
  it('assembles with default monthly cycle', () => {
    expect(buildApply({ planId: 'p1' })).toEqual({ ok: true, value: { planId: 'p1', billingCycle: 'monthly' } });
    expect(buildApply({ planId: 'p1', billingCycle: 'annual' })).toEqual({ ok: true, value: { planId: 'p1', billingCycle: 'annual' } });
  });
  it('rejects a missing plan', () => {
    expect(buildApply({ planId: '' })).toEqual({ ok: false, error: 'plan' });
    expect(buildApply({})).toEqual({ ok: false, error: 'plan' });
  });
});
