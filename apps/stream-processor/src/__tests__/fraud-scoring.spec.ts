import { scoreEvent, parseAmountMinor, DEFAULT_THRESHOLDS, FraudFeature } from '../fraud/scoring';

const base: FraudFeature = { amountMinor: 0n, ordersInWindow: 0, failedPaymentsInWindow: 0, accountAgeDays: 365, distinctDevicesInWindow: 1 };

describe('parseAmountMinor', () => {
  it('parses string minor units to bigint, fails safe to 0 (never floats/throws)', () => {
    expect(parseAmountMinor('250000')).toBe(250000n);
    expect(parseAmountMinor('0')).toBe(0n);
    expect(parseAmountMinor('12.5')).toBe(0n);   // not minor-unit integer
    expect(parseAmountMinor(undefined)).toBe(0n);
    expect(parseAmountMinor('-5')).toBe(0n);
  });
});

describe('scoreEvent', () => {
  it('a normal transaction scores low and is not flagged', () => {
    const a = scoreEvent(base);
    expect(a.flagged).toBe(false);
    expect(a.score).toBe(0);
  });
  it('high value alone is not enough to flag (below flagAt)', () => {
    const a = scoreEvent({ ...base, amountMinor: DEFAULT_THRESHOLDS.highValueMinor });
    expect(a.reasons).toContain('high_value_transaction');
    expect(a.flagged).toBe(false);   // 35 < 60
  });
  it('new account + high value compounds and flags', () => {
    const a = scoreEvent({ ...base, amountMinor: DEFAULT_THRESHOLDS.highValueMinor, accountAgeDays: 0 });
    expect(a.reasons).toEqual(expect.arrayContaining(['high_value_transaction', 'new_account', 'new_account_high_value']));
    expect(a.flagged).toBe(true);    // 35 + 15 + 15 = 65 >= 60
  });
  it('rapid velocity + repeated payment failures flags', () => {
    const a = scoreEvent({ ...base, ordersInWindow: 12, failedPaymentsInWindow: 4 });
    expect(a.reasons).toEqual(expect.arrayContaining(['order_velocity', 'repeated_payment_failures']));
    expect(a.flagged).toBe(false);   // 30 + 25 = 55 < 60
    expect(scoreEvent({ ...base, ordersInWindow: 12, failedPaymentsInWindow: 4, distinctDevicesInWindow: 5 }).flagged).toBe(true); // +20
  });
  it('score is clamped to 0..100', () => {
    const a = scoreEvent({ amountMinor: DEFAULT_THRESHOLDS.highValueMinor, ordersInWindow: 99, failedPaymentsInWindow: 99, accountAgeDays: 0, distinctDevicesInWindow: 99 });
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.score).toBeGreaterThanOrEqual(0);
  });
});
