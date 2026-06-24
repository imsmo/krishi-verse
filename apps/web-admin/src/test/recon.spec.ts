// apps/web-admin/src/test/recon.spec.ts · unit tests for the pure recon investigation state machine + guards.
import { canTransition, isTerminal, canStart, canResolve, canFalsePositive, investigationStatusKey, severityKey, validReason } from '../features/recon/recon';

describe('investigation state machine (mirrors admin-api)', () => {
  it('legal transitions', () => {
    expect(canTransition('open', 'investigating')).toBe(true);
    expect(canTransition('investigating', 'open')).toBe(true);
    expect(canTransition('resolved', 'open')).toBe(false);
    expect(canTransition('false_positive', 'investigating')).toBe(false);
  });
  it('UI action gating', () => {
    expect(canStart('open')).toBe(true);
    expect(canStart('investigating')).toBe(false);
    expect(canResolve('open')).toBe(true);
    expect(canResolve('investigating')).toBe(true);
    expect(canResolve('resolved')).toBe(false);
    expect(canFalsePositive('investigating')).toBe(true);
    expect(canFalsePositive('resolved')).toBe(false);
  });
  it('isTerminal', () => {
    expect(isTerminal('resolved')).toBe(true);
    expect(isTerminal('false_positive')).toBe(true);
    expect(isTerminal('open')).toBe(false);
  });
  it('status/severity key guards', () => {
    expect(investigationStatusKey('investigating')).toBe('investigating');
    expect(investigationStatusKey('weird')).toBe('open');
    expect(severityKey('critical')).toBe('critical');
    expect(severityKey('nope')).toBe('high');
  });
});

describe('validReason', () => {
  it('enforces 3..1000', () => {
    expect(validReason('ok')).toBe(false);
    expect(validReason('a valid note')).toBe(true);
    expect(validReason('')).toBe(false);
    expect(validReason(null)).toBe(false);
  });
});
