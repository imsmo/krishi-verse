// THE security test for the gateway: a socket may only subscribe to its OWN tenant's channels, only its OWN
// order timeline, and the MCC dashboard only with the operator permission. Every deny path is asserted —
// this is the boundary a hostile client attacks first (§4).
import { canSubscribe, SocketClaims } from '../auth/channel-authz';

const claims = (over: Partial<SocketClaims> = {}): SocketClaims => ({ sub: 'u1', tid: 't1', perms: [], ...over });

describe('canSubscribe — tenant isolation', () => {
  it('allows a same-tenant auction feed', () => {
    expect(canSubscribe(claims(), 't:t1:auction:a1')).toEqual({ ok: true });
  });
  it('DENIES another tenant’s auction (cross-tenant)', () => {
    expect(canSubscribe(claims({ tid: 't1' }), 't:t2:auction:a1')).toEqual({ ok: false, reason: 'cross_tenant' });
  });
});

describe('canSubscribe — per-user order timeline (no IDOR)', () => {
  it('allows the owner', () => {
    expect(canSubscribe(claims({ sub: 'u1' }), 't:t1:u:u1:orders')).toEqual({ ok: true });
  });
  it('DENIES another user’s orders', () => {
    expect(canSubscribe(claims({ sub: 'u1' }), 't:t1:u:u2:orders')).toEqual({ ok: false, reason: 'not_owner' });
  });
});

describe('canSubscribe — MCC dashboard (permission-gated)', () => {
  it('DENIES without dairy.manage', () => {
    expect(canSubscribe(claims(), 't:t1:mcc:m1')).toEqual({ ok: false, reason: 'forbidden' });
  });
  it('allows with dairy.manage', () => {
    expect(canSubscribe(claims({ perms: ['dairy.manage'] }), 't:t1:mcc:m1')).toEqual({ ok: true });
  });
  it('allows platform god-mode', () => {
    expect(canSubscribe(claims({ perms: ['*'] }), 't:t1:mcc:m1')).toEqual({ ok: true });
  });
});

describe('canSubscribe — malformed/unknown channels are rejected', () => {
  it.each([
    'garbage', 't:t1:wallet:w1', 't:t1:auction', 't:t1:u:u1', 't::auction:a1', 'x'.repeat(300),
  ])('denies %s', (ch) => {
    expect(canSubscribe(claims(), ch).ok).toBe(false);
  });
});
