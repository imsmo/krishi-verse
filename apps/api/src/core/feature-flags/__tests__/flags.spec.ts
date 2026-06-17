// core/feature-flags/__tests__/flags.spec.ts · default-OFF, kill-switch, allowlist, rollout.
import { FlagsService } from '../flags.service';

function svc(row: any) {
  const pools: any = { replica: () => ({ query: async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 }) }) };
  const cache: any = { wrap: (_k: string, _t: number, load: any) => load() };
  return new FlagsService(pools, cache);
}

describe('FlagsService.isEnabled', () => {
  it('unknown flag → OFF (fail-closed)', async () => {
    expect(await svc(null).isEnabled('x', { tenantId: 't1' })).toBe(false);
  });
  it('kill-switch (is_enabled=false) → OFF for everyone', async () => {
    expect(await svc({ is_enabled: false, rollout_pct: 100, rules: {} }).isEnabled('x', { tenantId: 't1' })).toBe(false);
  });
  it('100% rollout → ON', async () => {
    expect(await svc({ is_enabled: true, rollout_pct: 100, rules: {} }).isEnabled('x', { tenantId: 't1' })).toBe(true);
  });
  it('0% rollout → OFF unless explicitly allowlisted', async () => {
    expect(await svc({ is_enabled: true, rollout_pct: 0, rules: {} }).isEnabled('x', { tenantId: 't1' })).toBe(false);
    expect(await svc({ is_enabled: true, rollout_pct: 0, rules: { tenant_ids: ['t1'] } }).isEnabled('x', { tenantId: 't1' })).toBe(true);
  });
  it('rollout is deterministic for the same subject', async () => {
    const s = svc({ is_enabled: true, rollout_pct: 50, rules: {} });
    const a = await s.isEnabled('flagA', { tenantId: 't-stable' });
    const b = await s.isEnabled('flagA', { tenantId: 't-stable' });
    expect(a).toBe(b);
  });
});
