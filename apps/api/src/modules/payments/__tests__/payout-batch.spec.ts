// modules/payments/__tests__/payout-batch.spec.ts · pure-domain unit tests for the API-W3-08 payout-batch
// aggregate + its state machine, and the wage-lane priority constants. Money is bigint minor units.
// Service-level RLS/ledger behaviour is covered by payout-batch.integration.spec.ts (real Postgres).
import { PayoutBatch } from '../domain/payout-batch.entity';
import { canTransition, assertTransition, isTerminal, IllegalPayoutBatchTransitionError } from '../domain/payout-batch.state';
import { WAGE_LANE_PRIORITY, DEFAULT_PAYOUT_PRIORITY } from '../domain/payout.state';

describe('PayoutBatch aggregate', () => {
  it('opens empty and accumulates settled payouts (total + count)', () => {
    const b = PayoutBatch.open({ id: 'b1', tenantId: null, batchType: 'wage_lane' });
    expect(b.status).toBe('open');
    expect(b.totalMinor).toBe(0n);
    expect(b.count).toBe(0);
    b.markExecuting();
    b.addSettled(5000n);
    b.addSettled(2500n);
    expect(b.totalMinor).toBe(7500n);
    expect(b.count).toBe(2);
    b.markExecuted();
    expect(b.status).toBe('executed');
    expect(b.toProps().executedAt).toBeInstanceOf(Date);
  });

  it('rejects a bad batch type and a non-positive settled amount', () => {
    expect(() => PayoutBatch.open({ id: 'b', tenantId: null, batchType: '' })).toThrow();
    expect(() => PayoutBatch.open({ id: 'b', tenantId: null, batchType: 'x'.repeat(41) })).toThrow();
    const b = PayoutBatch.open({ id: 'b2', tenantId: 't1', batchType: 'settlement' });
    expect(() => b.addSettled(0n)).toThrow();
    expect(() => b.addSettled(-1n)).toThrow();
  });

  it('cannot add to a finalized batch', () => {
    const b = PayoutBatch.open({ id: 'b3', tenantId: null, batchType: 'settlement' });
    b.markExecuting(); b.markExecuted();
    expect(() => b.addSettled(100n)).toThrow();
  });
});

describe('payout-batch state machine', () => {
  it('allows open→executing→executed and open→failed / executing→failed', () => {
    expect(canTransition('open', 'executing')).toBe(true);
    expect(canTransition('executing', 'executed')).toBe(true);
    expect(canTransition('open', 'failed')).toBe(true);
    expect(canTransition('executing', 'failed')).toBe(true);
  });
  it('forbids skipping/reviving + throws a typed error', () => {
    expect(canTransition('open', 'executed')).toBe(false);
    expect(canTransition('executed', 'executing')).toBe(false);
    expect(() => assertTransition('executed', 'open')).toThrow(IllegalPayoutBatchTransitionError);
    expect(isTerminal('executed')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('open')).toBe(false);
  });
});

describe('wage priority lane', () => {
  it('the wage lane sorts ahead of the default settlement lane (lower number = first)', () => {
    expect(WAGE_LANE_PRIORITY).toBeLessThan(DEFAULT_PAYOUT_PRIORITY);
  });
});
