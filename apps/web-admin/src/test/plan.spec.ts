// apps/web-admin/src/test/plan.spec.ts · unit tests for the pure plan helpers: lifecycle gating + money-safe
// (float-free) create/pricing/version/limit builders.
import { canTransition, isActiveStatus, canPublish, canArchive, canReactivate, planStatusKey, buildCreatePlan, buildPricing, buildVersion, buildSetLimit, validFeatureCode } from '../features/plans/plan';

describe('plan lifecycle (mirrors admin-api)', () => {
  it('action gating', () => {
    expect(canPublish('draft')).toBe(true);
    expect(canPublish('active')).toBe(false);
    expect(canArchive('draft')).toBe(true);
    expect(canArchive('active')).toBe(true);
    expect(canArchive('archived')).toBe(false);
    expect(canReactivate('archived')).toBe(true);
    expect(canReactivate('active')).toBe(false);
  });
  it('transitions + sellability', () => {
    expect(canTransition('draft', 'active')).toBe(true);
    expect(canTransition('active', 'draft')).toBe(false);
    expect(isActiveStatus('active')).toBe(true);
    expect(isActiveStatus('archived')).toBe(false);
    expect(planStatusKey('weird')).toBe('draft');
  });
});

describe('buildCreatePlan (money-safe, float-free)', () => {
  it('assembles with minor-unit price strings', () => {
    const r = buildCreatePlan({ code: 'pro_in', defaultName: 'Pro', countryCode: 'in', currencyCode: 'inr', monthlyPriceMinor: '99900', annualPriceMinor: '999000', reason: 'launch pro' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value).toMatchObject({ code: 'pro_in', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '99900', annualPriceMinor: '999000', setupFeeMinor: '0', isPublic: true }); }
  });
  it('rejects float price / bad code / short reason', () => {
    expect(buildCreatePlan({ code: 'pro_in', defaultName: 'Pro', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '999.00', annualPriceMinor: '1', reason: 'ok x' })).toEqual({ ok: false, error: 'price' });
    expect(buildCreatePlan({ code: 'BAD', defaultName: 'Pro', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '1', annualPriceMinor: '1', reason: 'ok x' })).toEqual({ ok: false, error: 'code' });
    expect(buildCreatePlan({ code: 'pro_in', defaultName: 'Pro', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '1', annualPriceMinor: '1', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('buildPricing / buildVersion', () => {
  it('pricing accepts minor strings + reason', () => {
    expect(buildPricing({ monthlyPriceMinor: '100', annualPriceMinor: '1000', reason: 'price bump' })).toEqual({ ok: true, value: { monthlyPriceMinor: '100', annualPriceMinor: '1000', setupFeeMinor: '0', reason: 'price bump' } });
  });
  it('version carries optional isPublic', () => {
    const r = buildVersion({ monthlyPriceMinor: '100', annualPriceMinor: '1000', isPublic: 'false', reason: 'custom anchor' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.isPublic).toBe(false);
  });
  it('rejects float amounts', () => {
    expect(buildPricing({ monthlyPriceMinor: '1.5', annualPriceMinor: '1', reason: 'x y z' })).toEqual({ ok: false, error: 'price' });
  });
});

describe('buildSetLimit', () => {
  it('accepts -1 (unlimited) and integers', () => {
    expect(buildSetLimit({ limitCode: 'max_users', limitValue: '-1', reason: 'enterprise' })).toEqual({ ok: true, value: { limitValue: '-1', reason: 'enterprise' } });
    expect(buildSetLimit({ limitCode: 'max_listings', limitValue: '500', reason: 'bump it' }).ok).toBe(true);
  });
  it('rejects floats / bad code', () => {
    expect(buildSetLimit({ limitCode: 'max_users', limitValue: '5.5', reason: 'x y z' })).toEqual({ ok: false, error: 'limitValue' });
    expect(buildSetLimit({ limitCode: 'BAD CODE', limitValue: '5', reason: 'x y z' })).toEqual({ ok: false, error: 'limitCode' });
  });
});

describe('validFeatureCode', () => {
  it('guards the :code path param', () => {
    expect(validFeatureCode('ai.assistant')).toBe(true);
    expect(validFeatureCode('NOPE!')).toBe(false);
  });
});
