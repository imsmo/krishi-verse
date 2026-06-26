// apps/web-tenant/src/features/ambassadors/admin.test.ts · pure unit tests for the ambassadors admin helpers.
import { validateEnroll, validateTarget, previewUnpaidMinor, canPayout, canActivateReferral } from './admin';

const U = '00000000-0000-0000-0000-000000000001';

describe('ambassadors/admin — validators', () => {
  it('enroll requires a uuid user; stipend + clusters optional but validated', () => {
    expect(validateEnroll({ userId: 'x' })).toBe('user');
    expect(validateEnroll({ userId: U, monthlyStipendMinor: '12.5' })).toBe('stipend');
    expect(validateEnroll({ userId: U, clusterRegionIds: ['bad'] })).toBe('clusters');
    expect(validateEnroll({ userId: U, clusterRegionIds: [U, U, U, U] })).toBe('clusters');
    expect(validateEnroll({ userId: U, monthlyStipendMinor: '50000', clusterRegionIds: [U] })).toBeNull();
    expect(validateEnroll({ userId: U })).toBeNull();
  });

  it('target validates metric, dates + non-negative integer value', () => {
    const ok = { ambassadorId: U, metric: 'onboardings', periodStart: '2026-07-01', periodEnd: '2026-07-31', targetValue: '25' };
    expect(validateTarget(ok)).toBeNull();
    expect(validateTarget({ ...ok, ambassadorId: 'x' })).toBe('ambassador');
    expect(validateTarget({ ...ok, metric: 'bogus' })).toBe('metric');
    expect(validateTarget({ ...ok, periodEnd: 'bad' })).toBe('dates');
    expect(validateTarget({ ...ok, periodStart: '2026-08-01', periodEnd: '2026-07-01' })).toBe('dateOrder');
    expect(validateTarget({ ...ok, targetValue: '-5' })).toBe('value');
    expect(validateTarget({ ...ok, metric: 'earnings_minor', targetValue: '500000' })).toBeNull();
  });
});

describe('ambassadors/admin — payout preview + gating', () => {
  it('previewUnpaidMinor sums only unpaid earnings (float-free)', () => {
    expect(previewUnpaidMinor([
      { amountMinor: '12000', payoutId: null },
      { amountMinor: '8000', payoutId: null },
      { amountMinor: '99999', payoutId: 'po1' },   // already paid — excluded
    ])).toBe('20000');
    expect(previewUnpaidMinor([])).toBe('0');
  });

  it('canPayout only for an active ambassador with positive unpaid', () => {
    expect(canPayout({ isActive: true }, '20000')).toBe(true);
    expect(canPayout({ isActive: true }, '0')).toBe(false);
    expect(canPayout({ isActive: false }, '20000')).toBe(false);
  });

  it('canActivateReferral only for invited/signed_up', () => {
    expect(canActivateReferral('signed_up')).toBe(true);
    expect(canActivateReferral('invited')).toBe(true);
    expect(canActivateReferral('activated')).toBe(false);
    expect(canActivateReferral('rewarded')).toBe(false);
  });
});
