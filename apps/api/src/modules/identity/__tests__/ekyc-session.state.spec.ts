// Pure unit tests for the eKYC session state machine (Law 5: explicit, terminal states immutable).
import {
  EKYC_SESSION_STATUSES, EKYC_MAX_ATTEMPTS, isTerminalEkyc, canEkycTransition, assertEkycTransition,
} from '../domain/ekyc-session.state';
import { IllegalEkycTransitionError } from '../domain/identity.errors';

describe('ekyc-session.state', () => {
  it('exposes the four statuses + an attempt cap', () => {
    expect([...EKYC_SESSION_STATUSES]).toEqual(['pending', 'verified', 'failed', 'expired']);
    expect(EKYC_MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it('allows pending → verified/failed/expired only', () => {
    expect(canEkycTransition('pending', 'verified')).toBe(true);
    expect(canEkycTransition('pending', 'failed')).toBe(true);
    expect(canEkycTransition('pending', 'expired')).toBe(true);
  });

  it('treats verified/failed/expired as terminal (no further transitions)', () => {
    for (const t of ['verified', 'failed', 'expired'] as const) {
      expect(isTerminalEkyc(t)).toBe(true);
      expect(canEkycTransition(t, 'pending')).toBe(false);
      expect(canEkycTransition(t, 'verified')).toBe(false);
    }
    expect(isTerminalEkyc('pending')).toBe(false);
  });

  it('assertEkycTransition throws a typed error on an illegal move', () => {
    expect(() => assertEkycTransition('pending', 'verified')).not.toThrow();
    expect(() => assertEkycTransition('verified', 'failed')).toThrow(IllegalEkycTransitionError);
    expect(() => assertEkycTransition('failed', 'verified')).toThrow(IllegalEkycTransitionError);
  });
});
