// apps/web-admin/src/test/ticket.spec.ts · unit tests for the pure support-oversight helpers: escalatability +
// raise-only severity targets (mirror admin-api), the audited escalate builder, SLA badge + float-free age parts.
import { TICKET_STATUSES, ticketStatusKey, isTerminalForEscalation, canEscalate, SEVERITIES, severityRank, higherSeverities, buildEscalate, slaKey, ageParts } from '../features/support/ticket';

describe('ticket status (mirrors admin-api)', () => {
  it('escalatability', () => {
    expect(canEscalate('open')).toBe(true);
    expect(canEscalate('escalated')).toBe(true);
    expect(canEscalate('resolved')).toBe(false);
    expect(canEscalate('closed')).toBe(false);
    expect(isTerminalForEscalation('reopened')).toBe(false);
    expect(ticketStatusKey('weird')).toBe('open');
    expect(TICKET_STATUSES).toContain('pending_internal');
  });
});

describe('severity (raise-only, P0 most urgent)', () => {
  it('rank + raise targets', () => {
    expect(severityRank('P0')).toBe(0);
    expect(severityRank('P3')).toBe(3);
    expect(higherSeverities('P2')).toEqual(['P0', 'P1']);
    expect(higherSeverities('P0')).toEqual([]);
    expect(SEVERITIES.length).toBe(4);
  });
});

describe('buildEscalate (audited)', () => {
  it('accepts severity raise + reassign + reason', () => {
    const r = buildEscalate({ severity: 'P0', reassignToUserId: '11111111-1111-1111-1111-111111111111', reason: 'tenant SLA failing' });
    expect(r).toEqual({ ok: true, value: { severity: 'P0', reassignToUserId: '11111111-1111-1111-1111-111111111111', reason: 'tenant SLA failing' } });
  });
  it('reason-only is valid (status→escalated)', () => {
    expect(buildEscalate({ reason: 'escalate to platform' })).toEqual({ ok: true, value: { reason: 'escalate to platform' } });
  });
  it('rejects bad severity / non-uuid reassign / short reason', () => {
    expect(buildEscalate({ severity: 'P9', reason: 'ok x' })).toEqual({ ok: false, error: 'severity' });
    expect(buildEscalate({ reassignToUserId: 'not-a-uuid', reason: 'ok x' })).toEqual({ ok: false, error: 'reassign' });
    expect(buildEscalate({ reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('sla + age', () => {
  it('sla key', () => {
    expect(slaKey({ firstResponseBreached: true, resolutionBreached: false, breached: true })).toBe('breached');
    expect(slaKey({ firstResponseBreached: false, resolutionBreached: false, breached: false })).toBe('ok');
    expect(slaKey(null)).toBe('ok');
  });
  it('age parts (float-free)', () => {
    expect(ageParts(90061)).toEqual({ days: 1, hours: 1, minutes: 1 });
    expect(ageParts(0)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(ageParts(null)).toBeNull();
    expect(ageParts(-5)).toBeNull();
  });
});
