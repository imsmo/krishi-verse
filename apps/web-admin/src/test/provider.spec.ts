// apps/web-admin/src/test/provider.spec.ts · unit tests for the pure provider helpers: category vocabulary +
// financial lens, the no-op-rejecting enable/disable gating (mirrors admin-api 409), the degraded health signal,
// and the audited toggle builder.
import { PROVIDER_CATEGORIES, FINANCIAL_CATEGORIES, isValidCategory, categoryKey, canEnable, canDisable, buildToggle, isDegraded, providerHealthKey } from '../features/providers/provider';

describe('provider categories (mirror admin-api)', () => {
  it('vocabulary + financial lens', () => {
    expect(PROVIDER_CATEGORIES).toEqual(['payment', 'sms', 'kyc', 'government', 'satellite']);
    expect(FINANCIAL_CATEGORIES).toEqual(['payment', 'kyc']);
    expect(isValidCategory('payment')).toBe(true);
    expect(isValidCategory('nope')).toBe(false);
    expect(categoryKey('kyc')).toBe('kyc');
    expect(categoryKey('weird')).toBe('unknown');
  });
});

describe('toggle gating (rejects no-op, mirrors admin-api 409)', () => {
  it('enable only from inactive, disable only from active', () => {
    expect(canEnable(false)).toBe(true);
    expect(canEnable(true)).toBe(false);
    expect(canDisable(true)).toBe(true);
    expect(canDisable(false)).toBe(false);
  });
});

describe('buildToggle (audited)', () => {
  it('accepts a valid action + reason', () => {
    expect(buildToggle({ action: 'disable', reason: 'gateway down' })).toEqual({ ok: true, value: { action: 'disable', reason: 'gateway down' } });
  });
  it('rejects a bad action / short reason', () => {
    expect(buildToggle({ action: 'frob', reason: 'ok x' })).toEqual({ ok: false, error: 'action' });
    expect(buildToggle({ action: 'enable', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('degraded health signal', () => {
  it('degraded = disabled but still referenced', () => {
    expect(isDegraded({ isActive: false, health: { configuredTenants: 3, activeTenants: 0 } })).toBe(true);
    expect(isDegraded({ isActive: false, health: { configuredTenants: 0, activeTenants: 0 } })).toBe(false);
    expect(isDegraded({ isActive: true, health: { configuredTenants: 3, activeTenants: 3 } })).toBe(false);
  });
  it('health key', () => {
    expect(providerHealthKey({ isActive: true, health: { configuredTenants: 1, activeTenants: 1 } })).toBe('active');
    expect(providerHealthKey({ isActive: false, health: { configuredTenants: 0, activeTenants: 0 } })).toBe('disabled');
    expect(providerHealthKey({ isActive: false, health: { configuredTenants: 2, activeTenants: 0 } })).toBe('degraded');
  });
});
