// modules/payments/__tests__/payout.spec.ts · payout state machine + aggregate invariants (Law 5).
import { canTransition, assertTransition, isTerminal, IllegalPayoutTransitionError, PAYOUT_STATUSES, PayoutStatus } from '../domain/payout.state';
import { Payout } from '../domain/payout.entity';

function queued(amount = 100000n): Payout {
  return Payout.queue({ id: 'po1', tenantId: 't1', userId: 'u1', bankAccountId: 'b1', purposeId: 'pp1', referenceType: null, referenceId: null,
    amountMinor: amount, currencyCode: 'INR', providerCode: 'razorpayx', idempotencyKey: 'payout:po1', ledgerTxnId: 'txn1' });
}

describe('payout.state machine', () => {
  it('allows the documented disbursement transitions', () => {
    expect(canTransition('queued', 'processing')).toBe(true);
    expect(canTransition('processing', 'success')).toBe(true);
    expect(canTransition('processing', 'failed')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);   // retry
    expect(canTransition('success', 'reversed')).toBe(true); // clawback
  });
  it('forbids illegal jumps', () => {
    expect(canTransition('queued', 'success')).toBe(false);
    expect(() => assertTransition('reversed', 'success')).toThrow(IllegalPayoutTransitionError);
  });
  it('terminal states have no exits', () => {
    expect(isTerminal('reversed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
  });
  it('covers every status without throwing', () => {
    for (const s of PAYOUT_STATUSES) expect(() => canTransition(s, 'success' as PayoutStatus)).not.toThrow();
  });
});

describe('Payout aggregate', () => {
  it('queues positive-only and walks queued→processing→success', () => {
    const p = queued();
    expect(p.status).toBe('queued');
    p.startProcessing('gw_payout_1');
    expect(p.status).toBe('processing');
    expect(p.toProps().gatewayPayoutId).toBe('gw_payout_1');
    p.markSuccess();
    expect(p.status).toBe('success');
  });
  it('records failure reason and can be reversed', () => {
    const p = queued(); p.startProcessing('g'); p.markFailed('IFSC_INVALID', 'bad ifsc');
    expect(p.status).toBe('failed');
    expect(p.toProps().failureCode).toBe('IFSC_INVALID');
    p.reverse();
    expect(p.status).toBe('reversed');
  });
  it('rejects a non-positive payout', () => {
    expect(() => queued(0n)).toThrow();
  });
});
