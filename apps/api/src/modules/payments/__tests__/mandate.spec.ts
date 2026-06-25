// modules/payments/__tests__/mandate.spec.ts · the UPI mandate domain (pure: state machine, VPA masking,
// idempotent transitions). No DB, no money.
import { Mandate, maskVpa } from '../domain/mandate.entity';
import { canTransition, assertTransition, isLive, isTerminal, IllegalMandateTransitionError } from '../domain/mandate.state';
import { InvalidVpaError } from '../domain/payments.errors';

const baseInput = {
  id: 'm1', tenantId: 't1', userId: 'u1', providerCode: 'sandbox', vpaRaw: 'farmer.kumar@okhdfcbank',
  purpose: 'membership', maxAmountMinor: 50000n, currencyCode: 'INR', frequency: 'monthly', validUntil: null,
};

describe('maskVpa', () => {
  it('keeps ≤2 leading handle chars + the @psp suffix, hides the rest', () => {
    expect(maskVpa('farmer.kumar@okhdfcbank')).toBe('fa***@okhdfcbank');
    expect(maskVpa('ab@upi')).toBe('ab***@upi');
  });
  it('never leaks more than 2 handle chars', () => {
    expect(maskVpa('a.very.long.handle@ybl')).toBe('a.***@ybl');
  });
  it('rejects a malformed VPA (no @, bad shape)', () => {
    expect(() => maskVpa('not-a-vpa')).toThrow(InvalidVpaError);
    expect(() => maskVpa('@psp')).toThrow(InvalidVpaError);
    expect(() => maskVpa('')).toThrow(InvalidVpaError);
  });
});

describe('mandate.state transitions', () => {
  it('allows the documented forward transitions', () => {
    expect(canTransition('pending', 'active')).toBe(true);
    expect(canTransition('active', 'paused')).toBe(true);
    expect(canTransition('paused', 'active')).toBe(true);
    expect(canTransition('active', 'cancelled')).toBe(true);
    expect(canTransition('pending', 'expired')).toBe(true);
  });
  it('forbids transitions out of terminal states', () => {
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(canTransition('expired', 'active')).toBe(false);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('expired')).toBe(true);
    expect(isLive('pending')).toBe(true);
    expect(isLive('active')).toBe(true);
    expect(isLive('cancelled')).toBe(false);
  });
  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('cancelled', 'active')).toThrow(IllegalMandateTransitionError);
  });
});

describe('Mandate aggregate', () => {
  it('registers a pending mandate with a masked VPA + emits Registered (never the raw VPA)', () => {
    const m = Mandate.register(baseInput);
    const p = m.toProps();
    expect(p.status).toBe('pending');
    expect(p.vpaMasked).toBe('fa***@okhdfcbank');
    expect(p.providerMandateRef).toBeNull();
    const events = m.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payments.mandate_registered');
    expect(JSON.stringify(events[0].payload)).not.toContain('farmer.kumar');   // no raw VPA in the event
  });

  it('rejects a non-positive per-debit cap', () => {
    expect(() => Mandate.register({ ...baseInput, maxAmountMinor: 0n })).toThrow();
  });

  it('activates once (idempotent) and stamps the provider mandate ref', () => {
    const m = Mandate.register(baseInput);
    m.pullEvents();
    expect(m.activate('mandate_ABC')).toBe(true);
    expect(m.toProps().status).toBe('active');
    expect(m.toProps().providerMandateRef).toBe('mandate_ABC');
    expect(m.activate('mandate_ABC')).toBe(false);                              // repeat is a no-op
  });

  it('cancels once (idempotent) and records the reason', () => {
    const m = Mandate.register(baseInput);
    m.activate('mandate_ABC'); m.pullEvents();
    expect(m.cancel('user requested')).toBe(true);
    expect(m.toProps().status).toBe('cancelled');
    expect(m.toProps().cancelledReason).toBe('user requested');
    expect(m.cancel('again')).toBe(false);                                     // repeat is a no-op
  });
});
