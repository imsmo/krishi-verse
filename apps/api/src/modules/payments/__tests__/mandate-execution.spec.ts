// Pure tests for the P0-4 autopay execution guard: Mandate.assertCollectable (Law 5 — no money moves here).
import { Mandate, MandateProps } from '../domain/mandate.entity';
import { MandateNotActiveError, MandateAmountExceedsCapError } from '../domain/payments.errors';
import { MandateEventType } from '../domain/payments.events';

const base = (over: Partial<MandateProps> = {}): MandateProps => ({
  id: 'm1', tenantId: 't1', userId: 'u1', providerCode: 'sandbox', providerMandateRef: 'sbx_ref',
  vpaMasked: 'ab***@psp', purpose: 'membership', maxAmountMinor: 50000n, currencyCode: 'INR',
  frequency: 'as_presented', status: 'active', validUntil: null, cancelledReason: null, version: 3,
  createdAt: new Date('2026-01-01T00:00:00Z'), ...over,
});
const ctx = { executionId: 'e1', idempotencyKey: 'k1' };

describe('Mandate.assertCollectable', () => {
  it('allows a collection ≤ cap on an active mandate and records the Executed event', () => {
    const m = Mandate.rehydrate(base());
    expect(() => m.assertCollectable(50000n, ctx)).not.toThrow();
    const events = m.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(MandateEventType.Executed);
    expect(events[0].payload).toMatchObject({ mandateId: 'm1', amountMinor: '50000', executionId: 'e1', idempotencyKey: 'k1' });
  });

  it('rejects a collection over the per-debit cap (no event queued)', () => {
    const m = Mandate.rehydrate(base());
    expect(() => m.assertCollectable(50001n, ctx)).toThrow(MandateAmountExceedsCapError);
    expect(m.pullEvents()).toHaveLength(0);
  });

  it('rejects zero / negative amounts', () => {
    const m = Mandate.rehydrate(base());
    expect(() => m.assertCollectable(0n, ctx)).toThrow(MandateAmountExceedsCapError);
    expect(() => m.assertCollectable(-1n, ctx)).toThrow(MandateAmountExceedsCapError);
  });

  it.each(['pending', 'paused', 'cancelled', 'expired'] as const)('rejects a debit against a %s mandate', (status) => {
    const m = Mandate.rehydrate(base({ status }));
    expect(() => m.assertCollectable(100n, ctx)).toThrow(MandateNotActiveError);
    expect(m.pullEvents()).toHaveLength(0);
  });

  it('does NOT mutate the mandate status (pure guard — the money move + row insert are the caller\'s job)', () => {
    const m = Mandate.rehydrate(base());
    m.assertCollectable(1n, ctx);
    expect(m.status).toBe('active');
  });
});
