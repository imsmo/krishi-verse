// apps/web-admin/src/test/impersonation.spec.ts · unit tests for the pure act-as helpers: grant lifecycle gating
// (mirror admin-api — only active closes), and the start/reason builders incl. the deliberate read-only scope,
// time-box and ≥8-char justification bounds.
import { GRANT_STATUSES, grantStatusKey, isGrantActive, isGrantTerminal, canEndGrant, canRevokeGrant, buildStartGrant, buildReason, TTL_DEFAULT_SEC } from '../features/impersonation/grant';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

describe('grant lifecycle (mirrors admin-api)', () => {
  it('only active closes', () => {
    expect(canEndGrant('active')).toBe(true);
    expect(canRevokeGrant('active')).toBe(true);
    expect(canEndGrant('ended')).toBe(false);
    expect(canRevokeGrant('revoked')).toBe(false);
    expect(isGrantActive('active')).toBe(true);
    expect(isGrantTerminal('expired')).toBe(true);
    expect(grantStatusKey('weird')).toBe('expired');
    expect(GRANT_STATUSES).toContain('revoked');
  });
});

describe('buildStartGrant (read-only, time-boxed, justified)', () => {
  it('assembles with defaults', () => {
    const r = buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'investigating a support ticket' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ targetTenantId: TENANT, targetUserId: USER, ttlSec: TTL_DEFAULT_SEC, scope: 'read_only' });
  });
  it('accepts a bounded custom ttl', () => {
    const r = buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'investigating an issue', ttlSec: '600' });
    expect(r.ok && r.value.ttlSec).toBe(600);
  });
  it('rejects bad target / short reason / out-of-range ttl / bad scope', () => {
    expect(buildStartGrant({ targetTenantId: 'bad', targetUserId: USER, reason: 'long enough reason' })).toEqual({ ok: false, error: 'targetTenantId' });
    expect(buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'short' })).toEqual({ ok: false, error: 'reason' });
    expect(buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'long enough reason', ttlSec: '99999' })).toEqual({ ok: false, error: 'ttlSec' });
    expect(buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'long enough reason', ttlSec: '1.5' })).toEqual({ ok: false, error: 'ttlSec' });
    expect(buildStartGrant({ targetTenantId: TENANT, targetUserId: USER, reason: 'long enough reason', scope: 'write' })).toEqual({ ok: false, error: 'scope' });
  });
});

describe('buildReason (end/revoke)', () => {
  it('requires ≥8 chars', () => {
    expect(buildReason({ reason: 'finished the session' }).ok).toBe(true);
    expect(buildReason({ reason: 'short' })).toEqual({ ok: false, error: 'reason' });
  });
});
