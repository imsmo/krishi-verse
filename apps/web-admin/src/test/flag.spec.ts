// apps/web-admin/src/test/flag.spec.ts · unit tests for the pure feature-flag helpers: legal-action gating
// (mirrors flag.entity lock semantics) + the float-free builders (rollout %, targeting allowlists, create).
import { flagState, canEnable, canDisable, canSetRollout, canSetTargeting, canKill, canUnlock, parseRolloutPct, buildTargeting, buildCreateFlag } from '../features/flags/flag';

const f = (over: Partial<{ isEnabled: boolean; isLocked: boolean }>) => ({ isEnabled: false, isLocked: false, ...over });

describe('flag legal actions (mirror flag.entity Law 10)', () => {
  it('locked flag: only unlock (no enable/rollout/targeting/kill)', () => {
    const locked = f({ isLocked: true });
    expect(canUnlock(locked)).toBe(true);
    expect(canEnable(locked)).toBe(false);
    expect(canSetRollout(locked)).toBe(false);
    expect(canSetTargeting(locked)).toBe(false);
    expect(canKill(locked)).toBe(false);
  });
  it('unlocked off flag: enable + rollout + targeting + kill (not disable/unlock)', () => {
    const off = f({ isEnabled: false });
    expect(canEnable(off)).toBe(true);
    expect(canDisable(off)).toBe(false);
    expect(canKill(off)).toBe(true);
    expect(canUnlock(off)).toBe(false);
  });
  it('unlocked on flag: disable (not enable)', () => {
    const on = f({ isEnabled: true });
    expect(canDisable(on)).toBe(true);
    expect(canEnable(on)).toBe(false);
  });
  it('flagState', () => {
    expect(flagState(f({ isLocked: true }))).toBe('locked');
    expect(flagState(f({ isEnabled: true }))).toBe('on');
    expect(flagState(f({}))).toBe('off');
  });
});

describe('parseRolloutPct (integer 0..100, float-free)', () => {
  it('accepts 0..100 ints', () => { expect(parseRolloutPct('0')).toEqual({ ok: true, value: 0 }); expect(parseRolloutPct('100')).toEqual({ ok: true, value: 100 }); expect(parseRolloutPct('25')).toEqual({ ok: true, value: 25 }); });
  it('rejects floats / >100 / junk', () => { expect(parseRolloutPct('25.5').ok).toBe(false); expect(parseRolloutPct('101').ok).toBe(false); expect(parseRolloutPct('x').ok).toBe(false); });
});

describe('buildTargeting', () => {
  it('parses + validates allowlists', () => {
    const r = buildTargeting({ tenantIds: '11111111-1111-4111-8111-111111111111', plans: 'pro, basic', countries: 'in, us' });
    expect(r).toEqual({ ok: true, value: { tenantIds: ['11111111-1111-4111-8111-111111111111'], plans: ['pro', 'basic'], countries: ['IN', 'US'] } });
  });
  it('rejects a bad uuid / plan / country', () => {
    expect(buildTargeting({ tenantIds: 'not-a-uuid' }).ok).toBe(false);
    expect(buildTargeting({ plans: 'NOPE!' }).ok).toBe(false);
    expect(buildTargeting({ countries: 'usa' }).ok).toBe(false);
  });
});

describe('buildCreateFlag', () => {
  it('defaults to OFF/0% and assembles the body', () => {
    expect(buildCreateFlag({ key: 'payments.upi', reason: 'launch UPI' }))
      .toEqual({ ok: true, value: { key: 'payments.upi', rolloutPct: 0, reason: 'launch UPI', tenantIds: [], plans: [], countries: [] } });
  });
  it('rejects bad key / short reason', () => {
    expect(buildCreateFlag({ key: 'Bad Key', reason: 'launch UPI' })).toEqual({ ok: false, error: 'key' });
    expect(buildCreateFlag({ key: 'payments.upi', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});
