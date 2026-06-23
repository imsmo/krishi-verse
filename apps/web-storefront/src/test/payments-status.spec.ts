// apps/web-storefront/src/test/payments-status.spec.ts · the payment status → terminal outcome mapping that the
// checkout poll relies on. Anything not clearly success/failure stays 'pending' (we keep polling / show "we'll
// confirm shortly") — we never guess a charge succeeded.
import { paymentOutcome, isTerminal } from '../features/payments/status';

describe('paymentOutcome', () => {
  it('classifies success states', () => {
    for (const s of ['captured', 'succeeded', 'paid', 'settled', 'success', 'CAPTURED']) expect(paymentOutcome(s)).toBe('success');
  });
  it('classifies failure states', () => {
    for (const s of ['failed', 'cancelled', 'canceled', 'expired', 'voided']) expect(paymentOutcome(s)).toBe('failed');
  });
  it('everything else is pending (never assume a charge landed)', () => {
    expect(paymentOutcome('created')).toBe('pending');
    expect(paymentOutcome('authorized')).toBe('pending');
    expect(paymentOutcome('')).toBe('pending');
    expect(paymentOutcome(undefined)).toBe('pending');
  });
  it('isTerminal only for success/failure', () => {
    expect(isTerminal('captured')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
  });
});
