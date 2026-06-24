// apps/web-admin/src/test/scheme-registry.spec.ts · unit tests for the pure schemes-registry helpers: authority
// level + name validation, UUID-list + JSON-object parsing, money-safe fee, MM-DD window, and the builders.
import {
  AUTHORITY_LEVELS, authorityLevelKey, isMmDd, parseUuidList, parseJsonObject, parseFeeMinor, buildWindow,
  buildCreateAuthority, buildCreateScheme, buildUpdateRules, buildSetWindow, buildSetActive,
} from '../features/schemes-registry/scheme';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('primitives', () => {
  it('levels + MM-DD', () => {
    expect(AUTHORITY_LEVELS).toEqual(['central', 'state', 'district', 'body']);
    expect(authorityLevelKey('state')).toBe('state');
    expect(authorityLevelKey('weird')).toBe('body');
    expect(isMmDd('06-01')).toBe(true);
    expect(isMmDd('13-01')).toBe(false);
  });
  it('uuid list + json object + fee', () => {
    expect(parseUuidList(`${A}, ${A}`)).toEqual({ ok: true, value: [A] });
    expect(parseUuidList('nope')).toEqual({ ok: false });
    expect(parseJsonObject('{"max_income":50000}').ok).toBe(true);
    expect(parseJsonObject('{}')).toEqual({ ok: false });
    expect(parseJsonObject('[]')).toEqual({ ok: false });
    expect(parseFeeMinor('')).toBe('0');
    expect(parseFeeMinor('25000')).toBe('25000');
    expect(parseFeeMinor('2.5')).toBeNull();
  });
  it('window: both/neither/partial', () => {
    expect(buildWindow({ opens: '06-01', closes: '09-30', season: 'kharif' })).toEqual({ ok: true, value: { opens: '06-01', closes: '09-30', season: 'kharif' } });
    expect(buildWindow({})).toEqual({ ok: true, value: null });
    expect(buildWindow({ opens: '06-01' })).toEqual({ ok: false });
    expect(buildWindow({ opens: '13-40', closes: '09-30' })).toEqual({ ok: false });
  });
});

describe('authority builder', () => {
  it('create', () => {
    expect(buildCreateAuthority({ defaultName: 'Ministry of Agriculture', level: 'central', reason: 'seed authority' }).ok).toBe(true);
    expect(buildCreateAuthority({ defaultName: '<b>x</b>', level: 'central', reason: 'a reason' })).toEqual({ ok: false, error: 'defaultName' });
    expect(buildCreateAuthority({ defaultName: 'Dept', level: 'galactic', reason: 'a reason' })).toEqual({ ok: false, error: 'level' });
  });
});

describe('scheme builders', () => {
  it('create validates code/uuids/json/fee/window', () => {
    const r = buildCreateScheme({ code: 'pm_kisan', defaultName: 'PM-KISAN', authorityId: A, categoryId: B, benefitSummary: '{"amount":6000}', eligibilityRules: '{"land_max_ha":2}', requiredDocTypeIds: '', applicableRegionIds: '', processingFeeMinor: '0', applicationWindow_opens: '04-01', applicationWindow_closes: '07-31', reason: 'add scheme' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ code: 'pm_kisan', processingFeeMinor: '0', applicationWindow: { opens: '04-01', closes: '07-31' } });
    expect(buildCreateScheme({ code: 'PM Kisan', defaultName: 'x', authorityId: A, categoryId: B, benefitSummary: '{"a":1}', eligibilityRules: '{"b":2}', reason: 'a reason' })).toEqual({ ok: false, error: 'code' });
    expect(buildCreateScheme({ code: 'pmfby', defaultName: 'x', authorityId: 'bad', categoryId: B, benefitSummary: '{"a":1}', eligibilityRules: '{"b":2}', reason: 'a reason' })).toEqual({ ok: false, error: 'authorityId' });
    expect(buildCreateScheme({ code: 'pmfby', defaultName: 'x', authorityId: A, categoryId: B, benefitSummary: '{}', eligibilityRules: '{"b":2}', reason: 'a reason' })).toEqual({ ok: false, error: 'benefitSummary' });
  });
  it('updateRules / setWindow / setActive', () => {
    expect(buildUpdateRules({ benefitSummary: '{"amount":7000}', eligibilityRules: '{"land_max_ha":2}', processingFeeMinor: '100', reason: 'bump benefit' }).ok).toBe(true);
    expect(buildSetWindow({ opens: '', closes: '', reason: 'clear window' })).toEqual({ ok: true, value: { applicationWindow: null, reason: 'clear window' } });
    expect(buildSetActive({ isActive: 'true', reason: 'go live' })).toEqual({ ok: true, value: { isActive: true, reason: 'go live' } });
    expect(buildSetActive({ isActive: 'maybe', reason: 'x y z' })).toEqual({ ok: false, error: 'isActive' });
  });
});
