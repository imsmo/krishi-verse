// apps/web-admin/src/test/cell.spec.ts · unit tests for the pure cells/shards/placements helpers.
import {
  NODE_STATUSES, isNodeStatus, canTransition, statusTargets, acceptsPlacement, nodeStatusKey, nodeStatusTone,
  validCode, validCountry, validName, validNotes, validReason, parseCapacity, parseShardIndex, parseWeight,
  validUuid, parseBool, buildCreateCell, buildUpdateCell, buildSetStatus, buildSetDefault, buildSetResidencyLock,
  buildCreateShard, buildUpdateShard, buildPlace, buildMove, buildRemove, residencyWarnKey, residencyAtRisk,
  CellInputError,
} from '../features/cells/cell';

const UUID = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';

describe('node state machine', () => {
  it('has the four statuses', () => {
    expect(NODE_STATUSES).toEqual(['active', 'draining', 'readonly', 'retired']);
  });
  it('allows only the real transitions', () => {
    expect(canTransition('active', 'readonly')).toBe(true);
    expect(canTransition('active', 'draining')).toBe(true);
    expect(canTransition('readonly', 'active')).toBe(true);
    expect(canTransition('draining', 'retired')).toBe(true);
    expect(canTransition('active', 'retired')).toBe(false);
    expect(canTransition('retired', 'active')).toBe(false);
    expect(canTransition('active', 'active')).toBe(false);
  });
  it('lists legal targets', () => {
    expect(statusTargets('active')).toEqual(['readonly', 'draining']);
    expect(statusTargets('retired')).toEqual([]);
  });
  it('only active accepts placement', () => {
    expect(acceptsPlacement('active')).toBe(true);
    expect(acceptsPlacement('draining')).toBe(false);
  });
  it('maps status keys + tones', () => {
    expect(isNodeStatus('active')).toBe(true);
    expect(isNodeStatus('nope')).toBe(false);
    expect(nodeStatusKey('active')).toBe('cells.node.active');
    expect(nodeStatusKey('nope')).toBe('cells.node.unknown');
    expect(nodeStatusTone('active')).toBe('ok');
    expect(nodeStatusTone('draining')).toBe('warn');
    expect(nodeStatusTone('retired')).toBe('danger');
  });
});

describe('validators', () => {
  it('code: lowercases, enforces pattern', () => {
    expect(validCode(' AP-1 ')).toBe('ap-1');
    expect(() => validCode('1bad')).toThrow(CellInputError);
    expect(() => validCode('x')).toThrow();
  });
  it('country: 2-letter upper', () => {
    expect(validCountry('in')).toBe('IN');
    expect(() => validCountry('IND')).toThrow();
  });
  it('name + notes + reason bounds', () => {
    expect(validName(' South ')).toBe('South');
    expect(() => validName('')).toThrow();
    expect(validNotes('')).toBeNull();
    expect(validNotes(' hi ')).toBe('hi');
    expect(validReason('valid reason')).toBe('valid reason');
    expect(() => validReason('no')).toThrow();
  });
  it('capacity: nullable bounded int, float-free', () => {
    expect(parseCapacity('')).toBeNull();
    expect(parseCapacity('500')).toBe(500);
    expect(() => parseCapacity('1.5')).toThrow();
    expect(() => parseCapacity('-1')).toThrow();
    expect(() => parseCapacity('100000001')).toThrow();
  });
  it('shardIndex + weight bounds + weight default', () => {
    expect(parseShardIndex('0')).toBe(0);
    expect(() => parseShardIndex('100001')).toThrow();
    expect(parseWeight('')).toBe(100);
    expect(parseWeight('250')).toBe(250);
    expect(() => parseWeight('10001')).toThrow();
  });
  it('uuid + bool', () => {
    expect(validUuid(UUID, 'k')).toBe(UUID);
    expect(() => validUuid('nope', 'k')).toThrow();
    expect(parseBool('true')).toBe(true);
    expect(parseBool('on')).toBe(true);
    expect(parseBool('false')).toBe(false);
    expect(parseBool(undefined)).toBe(false);
  });
});

describe('builders', () => {
  it('create cell defaults residency-lock ON', () => {
    const b = buildCreateCell({ code: 'in-south', displayName: 'IN South', countryCode: 'in', capacityTenants: '', notes: '', reason: 'spin up' });
    expect(b).toEqual({ code: 'in-south', displayName: 'IN South', countryCode: 'IN', isDefault: false, residencyLocked: true, capacityTenants: null, notes: null, reason: 'spin up' });
  });
  it('create cell honours explicit unlock', () => {
    const b = buildCreateCell({ code: 'in-x', displayName: 'X', countryCode: 'IN', residencyLocked: 'false', capacityTenants: '10', notes: 'n', reason: 'reasoned' });
    expect(b.residencyLocked).toBe(false);
    expect(b.capacityTenants).toBe(10);
  });
  it('update cell requires ≥1 change', () => {
    expect(() => buildUpdateCell({ reason: 'reasoned' })).toThrow(CellInputError);
    const b = buildUpdateCell({ displayName: 'New', reason: 'reasoned' });
    expect(b).toEqual({ displayName: 'New', reason: 'reasoned' });
  });
  it('set status enforces transition', () => {
    expect(buildSetStatus('active', 'draining', 'drain it')).toEqual({ status: 'draining', reason: 'drain it' });
    expect(() => buildSetStatus('active', 'retired', 'bad')).toThrow();
    expect(() => buildSetStatus('active', 'bogus', 'bad')).toThrow();
  });
  it('default + residency-lock toggles', () => {
    expect(buildSetDefault(true, 'make default')).toEqual({ isDefault: true, reason: 'make default' });
    expect(buildSetResidencyLock(false, 'unlock it')).toEqual({ residencyLocked: false, reason: 'unlock it' });
  });
  it('create shard parses index + weight default', () => {
    const b = buildCreateShard({ cellId: UUID, shardIndex: '3', weight: '', notes: '', reason: 'add shard' });
    expect(b).toEqual({ cellId: UUID, shardIndex: 3, weight: 100, notes: null, reason: 'add shard' });
  });
  it('update shard ≥1, no dsn field ever', () => {
    expect(() => buildUpdateShard({ reason: 'reasoned' })).toThrow();
    const b = buildUpdateShard({ weight: '200', reason: 'reasoned' });
    expect(b).toEqual({ weight: 200, reason: 'reasoned' });
    expect('dsnSecretRef' in b).toBe(false);
  });
  it('place + move + remove', () => {
    expect(buildPlace({ tenantId: UUID, cellId: UUID2, shardId: UUID, pinned: 'true', reason: 'place it' }))
      .toEqual({ tenantId: UUID, cellId: UUID2, shardId: UUID, pinned: true, reason: 'place it' });
    expect(buildMove({ cellId: UUID2, shardId: UUID, reason: 'move it' }))
      .toEqual({ cellId: UUID2, shardId: UUID, reason: 'move it' });
    expect(buildMove({ cellId: UUID2, shardId: UUID, pinned: 'true', reason: 'move it' }).pinned).toBe(true);
    expect(buildRemove('remove it')).toEqual({ reason: 'remove it' });
  });
});

describe('residency warnings', () => {
  it('keys per action', () => {
    expect(residencyWarnKey('unlock')).toBe('cells.warn.unlock');
    expect(residencyWarnKey('move')).toBe('cells.warn.move');
    expect(residencyWarnKey('lock')).toBe('cells.warn.lock');
  });
  it('at-risk when tenants present and not all locked', () => {
    expect(residencyAtRisk({ countryCode: 'IN', cells: 2, activeCells: 2, allResidencyLocked: false, placedTenants: 5 })).toBe(true);
    expect(residencyAtRisk({ countryCode: 'IN', cells: 2, activeCells: 2, allResidencyLocked: true, placedTenants: 5 })).toBe(false);
    expect(residencyAtRisk({ countryCode: 'IN', cells: 2, activeCells: 2, allResidencyLocked: false, placedTenants: 0 })).toBe(false);
  });
});
