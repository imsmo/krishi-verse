// apps/web-admin/src/test/compliance.spec.ts · unit tests for the pure compliance helpers: DSR + breach state
// machines (mirror admin-api), the export-approval gate, retention validation (float-free month counts), and the
// audited builders incl. the DPDP §8 notify-requires-both-timestamps rule.
import {
  dsrStatusKey, isDsrTerminal, canStartDsr, canCompleteDsr, canRejectDsr, buildDsrUpdate,
  canDecideExport, buildExportDecision, buildRetention,
  breachStatusKey, breachSeverityKey, canContainBreach, canNotifyBreach, canCloseBreach, buildOpenBreach, buildBreachUpdate,
} from '../features/compliance/compliance';

describe('DSR state machine (mirrors admin-api)', () => {
  it('action gating', () => {
    expect(canStartDsr('open')).toBe(true);
    expect(canStartDsr('in_progress')).toBe(false);
    expect(canCompleteDsr('in_progress')).toBe(true);
    expect(canCompleteDsr('open')).toBe(false);
    expect(canRejectDsr('open')).toBe(true);
    expect(canRejectDsr('completed')).toBe(false);
    expect(isDsrTerminal('rejected')).toBe(true);
    expect(dsrStatusKey('weird')).toBe('open');
  });
  it('buildDsrUpdate', () => {
    expect(buildDsrUpdate({ action: 'complete', resolution: 'fulfilled access bundle' }).ok).toBe(true);
    expect(buildDsrUpdate({ action: 'nope', resolution: 'x y z' })).toEqual({ ok: false, error: 'action' });
    expect(buildDsrUpdate({ action: 'reject', resolution: 'no' })).toEqual({ ok: false, error: 'resolution' });
    expect(buildDsrUpdate({ action: 'complete', resolution: 'ok done', exportMediaId: 'bad' })).toEqual({ ok: false, error: 'exportMediaId' });
  });
});

describe('export approval gate', () => {
  it('decidable only while pending', () => {
    expect(canDecideExport('pending')).toBe(true);
    expect(canDecideExport('approved')).toBe(false);
  });
  it('buildExportDecision', () => {
    expect(buildExportDecision({ decision: 'approve', reason: 'verified scope' }).ok).toBe(true);
    expect(buildExportDecision({ decision: 'maybe', reason: 'x y z' })).toEqual({ ok: false, error: 'decision' });
    expect(buildExportDecision({ decision: 'reject', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('buildRetention (float-free month counts)', () => {
  it('assembles + coerces integers', () => {
    const r = buildRetention({ tableName: 'audit_log', activeMonths: '24', archiveMonths: '120', action: 'archive', reason: 'DPDP policy' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ tableName: 'audit_log', activeMonths: 24, archiveMonths: 120, action: 'archive', isActive: true });
  });
  it('archive blank → null; rejects floats / bad table / bad action', () => {
    const r = buildRetention({ tableName: 'orders', activeMonths: '12', archiveMonths: '', action: 'delete', reason: 'short policy' });
    expect(r.ok && r.value.archiveMonths).toBe(null);
    expect(buildRetention({ tableName: 'orders', activeMonths: '12.5', action: 'delete', reason: 'x y z' })).toEqual({ ok: false, error: 'activeMonths' });
    expect(buildRetention({ tableName: 'BAD TABLE', activeMonths: '1', action: 'delete', reason: 'x y z' })).toEqual({ ok: false, error: 'tableName' });
    expect(buildRetention({ tableName: 'orders', activeMonths: '1', action: 'frob', reason: 'x y z' })).toEqual({ ok: false, error: 'action' });
  });
});

describe('breach state machine (mirrors admin-api)', () => {
  it('action gating', () => {
    expect(canContainBreach('open')).toBe(true);
    expect(canContainBreach('contained')).toBe(false);
    expect(canNotifyBreach('contained')).toBe(true);
    expect(canNotifyBreach('open')).toBe(false);
    expect(canCloseBreach('open')).toBe(true);
    expect(canCloseBreach('notified')).toBe(true);
    expect(canCloseBreach('closed')).toBe(false);
    expect(breachStatusKey('weird')).toBe('open');
    expect(breachSeverityKey('nope')).toBe('high');
  });
  it('buildOpenBreach (categories only, no raw PII)', () => {
    const r = buildOpenBreach({ severity: 'critical', title: 'S3 misconfig', description: 'bucket public 2h', affectedData: 'phone,email', affectedCount: '1200', detectedAt: '2026-06-01T00:00:00Z' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ severity: 'critical', affectedCount: 1200 });
    expect(buildOpenBreach({ title: 'x', description: 'enough text', affectedData: 'phone', detectedAt: '2026-06-01T00:00:00Z' })).toEqual({ ok: false, error: 'title' });
  });
  it('buildBreachUpdate notify requires both timestamps (DPDP §8)', () => {
    expect(buildBreachUpdate({ action: 'contain', note: 'isolated host' }).ok).toBe(true);
    expect(buildBreachUpdate({ action: 'notify', note: 'regulator informed' })).toEqual({ ok: false, error: 'notifiedAt' });
    expect(buildBreachUpdate({ action: 'notify', note: 'both informed', regulatorNotifiedAt: '2026-06-02T00:00:00Z', principalsNotifiedAt: '2026-06-02T01:00:00Z' }).ok).toBe(true);
  });
});
