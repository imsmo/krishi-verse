// Unit tests for the pure session state machine. No React/expo — exercises every transition + the refresh-skew
// logic, including the guard that a late TOKENS_REFRESHED can't resurrect a signed-out session.
import { sessionReducer, initialSession, needsRefresh, type SessionState } from '../auth/session.reducer';
import type { AuthTokens } from '@krishi-verse/sdk-js';

const tokens: AuthTokens = { accessToken: 'a', refreshToken: 'r', expiresInSec: 900 };

describe('sessionReducer', () => {
  it('boots to anonymous when no tokens restored', () => {
    const s = sessionReducer(initialSession, { type: 'BOOT_RESTORED', language: 'hi' });
    expect(s.status).toBe('anonymous');
    expect(s.language).toBe('hi');
  });

  it('boots to authenticated when tokens restored', () => {
    const s = sessionReducer(initialSession, { type: 'BOOT_RESTORED', language: 'en', tokens: { ...tokens, expiresAtMs: 123 } });
    expect(s.status).toBe('authenticated');
    expect(s.accessToken).toBe('a');
    expect(s.expiresAtMs).toBe(123);
  });

  it('signs in and computes absolute expiry from nowMs', () => {
    const s = sessionReducer({ ...initialSession, status: 'anonymous' }, { type: 'SIGNED_IN', tokens, nowMs: 1_000 });
    expect(s.status).toBe('authenticated');
    expect(s.expiresAtMs).toBe(1_000 + 900_000);
  });

  it('selects role and sets language', () => {
    let s: SessionState = sessionReducer(initialSession, { type: 'SIGNED_IN', tokens, nowMs: 0 });
    s = sessionReducer(s, { type: 'ROLE_SELECTED', role: 'farmer' });
    s = sessionReducer(s, { type: 'LANGUAGE_SET', language: 'gu' });
    expect(s.activeRole).toBe('farmer');
    expect(s.language).toBe('gu');
  });

  it('PROFILE_LOADED defaults activeRole to the first server role when unset', () => {
    const s0 = sessionReducer(initialSession, { type: 'SIGNED_IN', tokens, nowMs: 0 });
    const s = sessionReducer(s0, { type: 'PROFILE_LOADED', profile: { id: 'u1', displayName: 'Ramesh', roles: ['buyer', 'farmer'], locale: 'hi' } });
    expect(s.profile?.displayName).toBe('Ramesh');
    expect(s.activeRole).toBe('buyer');
  });

  it('signs out and keeps only the language', () => {
    const s0 = sessionReducer({ ...initialSession, language: 'gu' }, { type: 'SIGNED_IN', tokens, nowMs: 0 });
    const s = sessionReducer(s0, { type: 'SIGNED_OUT' });
    expect(s.status).toBe('anonymous');
    expect(s.language).toBe('gu');
    expect(s.accessToken).toBeUndefined();
  });

  it('does NOT resurrect a signed-out session via a late refresh', () => {
    const out = sessionReducer(initialSession, { type: 'SIGNED_OUT' });
    const s = sessionReducer(out, { type: 'TOKENS_REFRESHED', tokens, nowMs: 0 });
    expect(s.status).toBe('anonymous');
  });
});

describe('needsRefresh', () => {
  const authed = (expiresAtMs?: number): SessionState => ({ status: 'authenticated', refreshToken: 'r', expiresAtMs, language: 'en' });
  it('is false for anonymous', () => expect(needsRefresh(initialSession, 0)).toBe(false));
  it('is true within the skew window', () => expect(needsRefresh(authed(10_000), 9_000, 60_000)).toBe(true));
  it('is false when comfortably valid', () => expect(needsRefresh(authed(10_000_000), 0, 60_000)).toBe(false));
  it('is true when expiry unknown', () => expect(needsRefresh(authed(undefined), 0)).toBe(true));
});
