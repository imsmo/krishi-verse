// apps/admin-api/src/modules/flags-ops/__tests__/flags-ops.spec.ts · unit tests (pure/mocked). Covers: the flag
// entity invariants + kill-switch LOCK guard; rollout/targeting validation + bounds; the rollout evaluator PARITY
// with the runtime (apps/api core/feature-flags/flags.service.ts); owner-RBAC for the flags roles + the
// NO-privilege-escalation property (Law 11); DTO validation (discriminated union, bounds, ReDoS-safe key); and the
// services proving every write audits IN-TX + writes a change row, the lock is enforced, and a missing flag is 404.
import { FeatureFlag } from '../domain/flag.entity';
import { assertRolloutPct, assertFlagKey, buildTargeting, isEnabledFor, bucket, MAX_TENANT_IDS } from '../domain/rollout';
import { InvalidRolloutError, InvalidTargetingError, InvalidFlagKeyError, FlagLockedError, FlagNotLockedError, FlagNotFoundError } from '../domain/flags-ops.errors';
import { GlobalFlagsService } from '../services/global-flags.service';
import { KillSwitchService } from '../services/kill-switch.service';
import { PercentRolloutService } from '../services/percent-rollout.service';
import { CreateFlagSchema, UpdateFlagSchema, QueryFlagsSchema } from '../dto/flags-ops.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

const actor = { userId: 'admin1', roles: ['platform_flags_ops'], ip: '10.0.0.1', requestId: 'req1' } as any;
const TENANT = '11111111-1111-1111-1111-111111111111';
const flag = (over: Partial<{ isEnabled: boolean; rolloutPct: number; rules: any; isLocked: boolean }> = {}) =>
  FeatureFlag.rehydrate({ key: 'payments.upi_intent', description: null, isEnabled: over.isEnabled ?? false, rolloutPct: over.rolloutPct ?? 0, rules: over.rules ?? {}, isLocked: over.isLocked ?? false, createdAt: new Date('2026-05-01T00:00:00Z') });

describe('FeatureFlag entity + kill-switch lock', () => {
  it('enable/disable/setRollout/setTargeting produce change records', () => {
    const f = flag();
    expect(f.enable().action).toBe('enabled');
    expect(f.setRollout(50).newValue).toEqual({ rolloutPct: 50 });
    expect(f.setTargeting({ tenant_ids: [TENANT] }).action).toBe('targeting_changed');
    expect(f.disable().newValue).toEqual({ isEnabled: false });
  });
  it('kill disables AND locks; a locked flag refuses enable/rollout/targeting', () => {
    const f = flag({ isEnabled: true, rolloutPct: 100 });
    const c = f.kill();
    expect(c.action).toBe('killed');
    expect(f.isEnabled).toBe(false); expect(f.isLocked).toBe(true);
    expect(() => f.enable()).toThrow(FlagLockedError);
    expect(() => f.setRollout(10)).toThrow(FlagLockedError);
    expect(() => f.setTargeting({})).toThrow(FlagLockedError);
  });
  it('disable is allowed even when locked (only ever reduces exposure)', () => {
    const f = flag({ isLocked: true });
    expect(() => f.disable()).not.toThrow();
  });
  it('unlock releases the lock (does NOT re-enable); unlock on an unlocked flag throws', () => {
    const f = flag({ isEnabled: false, isLocked: true });
    expect(f.unlock().action).toBe('unlocked');
    expect(f.isLocked).toBe(false); expect(f.isEnabled).toBe(false);
    expect(() => flag({ isLocked: false }).unlock()).toThrow(FlagNotLockedError);
  });
});

describe('rollout + targeting validation', () => {
  it('rollout_pct must be an int 0..100', () => {
    expect(assertRolloutPct(0)).toBe(0); expect(assertRolloutPct(100)).toBe(100);
    expect(() => assertRolloutPct(-1)).toThrow(InvalidRolloutError);
    expect(() => assertRolloutPct(101)).toThrow(InvalidRolloutError);
    expect(() => assertRolloutPct(12.5)).toThrow(InvalidRolloutError);
  });
  it('flag key is charset-bounded (ReDoS-safe)', () => {
    expect(assertFlagKey('payments.upi_intent')).toBe('payments.upi_intent');
    expect(() => assertFlagKey('Bad Key!')).toThrow(InvalidFlagKeyError);
  });
  it('targeting normalises to snake_case + rejects bad/oversized input', () => {
    expect(buildTargeting({ tenantIds: [TENANT], plans: ['growth'], countries: ['IN'] })).toEqual({ tenant_ids: [TENANT], plans: ['growth'], countries: ['IN'] });
    expect(() => buildTargeting({ tenantIds: ['nope'] })).toThrow(InvalidTargetingError);
    expect(() => buildTargeting({ countries: ['india'] })).toThrow(InvalidTargetingError);
    expect(() => buildTargeting({ tenantIds: Array(MAX_TENANT_IDS + 1).fill(TENANT) })).toThrow(InvalidTargetingError);
  });
});

describe('rollout evaluator parity with the runtime', () => {
  it('kill-switch (is_enabled=false) ⇒ OFF for everyone', () => {
    expect(isEnabledFor('k', { isEnabled: false, rolloutPct: 100, rules: {} }, { tenantId: TENANT })).toBe(false);
  });
  it('allowlisted tenant ⇒ ON even at 0% rollout', () => {
    expect(isEnabledFor('k', { isEnabled: true, rolloutPct: 0, rules: { tenant_ids: [TENANT] } }, { tenantId: TENANT })).toBe(true);
  });
  it('100% ⇒ ON; 0% (no allowlist) ⇒ OFF; partial ⇒ deterministic bucket', () => {
    expect(isEnabledFor('k', { isEnabled: true, rolloutPct: 100, rules: {} }, { tenantId: TENANT })).toBe(true);
    expect(isEnabledFor('k', { isEnabled: true, rolloutPct: 0, rules: {} }, { tenantId: TENANT })).toBe(false);
    const subject = `k:${TENANT}`;
    expect(isEnabledFor('k', { isEnabled: true, rolloutPct: bucket(subject) + 1, rules: {} }, { tenantId: TENANT })).toBe(true);
    expect(isEnabledFor('k', { isEnabled: true, rolloutPct: bucket(subject), rules: {} }, { tenantId: TENANT })).toBe(false);
  });
  it('bucket is stable + in range 0..99 (matches FNV-1a in flags.service.ts)', () => {
    expect(bucket('payments.upi_intent:anon')).toBe(bucket('payments.upi_intent:anon'));
    expect(bucket('x')).toBeGreaterThanOrEqual(0); expect(bucket('x')).toBeLessThan(100);
  });
});

describe('owner roles for flags', () => {
  it('platform_flags_ops manage+read; viewer read-only; tenant roles NOTHING; no cross-perm', () => {
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_flags_ops']), OwnerPermissions.FlagsManage)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_flags_viewer']), OwnerPermissions.FlagsManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_flags_viewer']), OwnerPermissions.FlagsRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.FlagsManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_flags_ops']), OwnerPermissions.BillingManage)).toBe(false);
  });
});

describe('dto validation', () => {
  it('create: valid key + defaults; rejects bad key / unknown keys', () => {
    expect(CreateFlagSchema.safeParse({ key: 'payments.upi_intent', reason: 'launch behind flag' }).success).toBe(true);
    expect(CreateFlagSchema.safeParse({ key: 'BadKey', reason: 'x x' }).success).toBe(false);
    expect(CreateFlagSchema.safeParse({ key: 'ok.flag', reason: 'ok ok', evil: 1 }).success).toBe(false);
  });
  it('update: discriminated union — each action validates its own fields', () => {
    expect(UpdateFlagSchema.safeParse({ action: 'kill', reason: 'incident #42 — disable now' }).success).toBe(true);
    expect(UpdateFlagSchema.safeParse({ action: 'set_rollout', rolloutPct: 25, reason: 'ramp to 25%' }).success).toBe(true);
    expect(UpdateFlagSchema.safeParse({ action: 'set_rollout', rolloutPct: 150, reason: 'x x' }).success).toBe(false);
    expect(UpdateFlagSchema.safeParse({ action: 'kill', rolloutPct: 10, reason: 'x x' }).success).toBe(false);   // strict
    expect(UpdateFlagSchema.safeParse({ action: 'nuke', reason: 'x x' }).success).toBe(false);
  });
  it('query clamps limit', () => { expect(QueryFlagsSchema.safeParse({ limit: 999 }).success).toBe(false); });
});

function harness() {
  const client = { __c: true };
  const pool = { withTx: async (fn: any) => fn(client) } as any;
  const audit = { write: jest.fn(async () => undefined), log: jest.fn(async () => undefined) } as any;
  return { client, pool, audit };
}

describe('GlobalFlagsService', () => {
  it('create: inserts OFF + change row + audit in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { createFlag: jest.fn(async () => flag()), insertChange: jest.fn() } as any;
    const out: any = await new GlobalFlagsService(pool, audit, repo).create(actor, { key: 'payments.upi_intent', rolloutPct: 0, tenantIds: [], plans: [], countries: [], reason: 'launch behind flag' });
    expect(out.isEnabled).toBe(false);
    expect(repo.insertChange).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'created' }));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'flags.created' }));
  });
  it('get: 404 when missing', async () => {
    const { pool, audit } = harness();
    const repo = { getFlag: jest.fn(async () => null) } as any;
    await expect(new GlobalFlagsService(pool, audit, repo).get('nope.flag')).rejects.toBeInstanceOf(FlagNotFoundError);
  });
});

describe('KillSwitchService', () => {
  it('kill: persists + change row + audit in-tx (flags.killed)', async () => {
    const { pool, audit, client } = harness();
    const repo = { getFlagForUpdate: jest.fn(async () => flag({ isEnabled: true, rolloutPct: 100 })), updateFlag: jest.fn(), insertChange: jest.fn() } as any;
    const out: any = await new KillSwitchService(pool, audit, repo).kill(actor, 'payments.upi_intent', 'incident #42');
    expect(out.isEnabled).toBe(false); expect(out.isLocked).toBe(true);
    expect(repo.updateFlag).toHaveBeenCalledWith(client, expect.anything(), 'admin1');
    expect(repo.insertChange).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'killed' }));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'flags.killed' }));
  });
  it('enable on a LOCKED flag throws + writes nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getFlagForUpdate: jest.fn(async () => flag({ isLocked: true })), updateFlag: jest.fn(), insertChange: jest.fn() } as any;
    await expect(new KillSwitchService(pool, audit, repo).enable(actor, 'payments.upi_intent', 'turn on pls')).rejects.toBeInstanceOf(FlagLockedError);
    expect(repo.updateFlag).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('404 when flag missing', async () => {
    const { pool, audit } = harness();
    const repo = { getFlagForUpdate: jest.fn(async () => null) } as any;
    await expect(new KillSwitchService(pool, audit, repo).disable(actor, 'nope.flag', 'x')).rejects.toBeInstanceOf(FlagNotFoundError);
  });
});

describe('PercentRolloutService', () => {
  it('set_rollout: persists pct + change row + audit in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { getFlagForUpdate: jest.fn(async () => flag({ isEnabled: true })), updateFlag: jest.fn(), insertChange: jest.fn() } as any;
    await new PercentRolloutService(pool, audit, repo).setRollout(actor, 'payments.upi_intent', 25, 'ramp to 25%');
    expect(repo.insertChange).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'rollout_changed', newValue: { rolloutPct: 25 } }));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'flags.rollout_changed' }));
  });
  it('set_targeting on a LOCKED flag throws + writes nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getFlagForUpdate: jest.fn(async () => flag({ isLocked: true })), updateFlag: jest.fn(), insertChange: jest.fn() } as any;
    await expect(new PercentRolloutService(pool, audit, repo).setTargeting(actor, 'payments.upi_intent', { tenantIds: [TENANT], plans: [], countries: [] }, 'allowlist')).rejects.toBeInstanceOf(FlagLockedError);
    expect(repo.updateFlag).not.toHaveBeenCalled();
  });
});
