// modules/identity/__tests__/state-machines.spec.ts · user + KYC transition tables.
import { canTransition, assertUserTransition, isLoginable } from '../domain/user.state';
import { canKycTransition, assertKycTransition } from '../domain/kyc-document.state';
import { IllegalUserTransitionError, IllegalKycTransitionError } from '../domain/identity.errors';

describe('user.state', () => {
  it('allows active→suspended, forbids soft_deleted→active', () => {
    expect(canTransition('active', 'suspended')).toBe(true);
    expect(canTransition('soft_deleted', 'active')).toBe(false);
    expect(() => assertUserTransition('soft_deleted', 'active')).toThrow(IllegalUserTransitionError);
  });
  it('restricted is still loginable; suspended is not', () => {
    expect(isLoginable('restricted')).toBe(true);
    expect(isLoginable('suspended')).toBe(false);
  });
});
describe('kyc.state', () => {
  it('pending→verified ok; verified→pending illegal', () => {
    expect(canKycTransition('pending', 'verified')).toBe(true);
    expect(canKycTransition('verified', 'pending')).toBe(false);
    expect(() => assertKycTransition('verified', 'pending')).toThrow(IllegalKycTransitionError);
  });
});
