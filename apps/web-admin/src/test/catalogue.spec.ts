// apps/web-admin/src/test/catalogue.spec.ts · unit tests for the pure catalogue helpers: code/slug/name + meta
// validation, float-free sortOrder/minAge, and the create/update/move builders (mirror admin-api DTO + domain).
import {
  COMMERCE_KINDS, commerceKindKey, parseSortOrder, parseMeta, buildCreateType, buildUpdateType,
  buildCreateValue, buildUpdateValue, buildSetActive, buildCreateCategory, buildUpdateCategory, buildMove,
} from '../features/catalogue/catalogue';

describe('parseMeta + parseSortOrder', () => {
  it('meta accepts a flat object, rejects non-object / bad values', () => {
    expect(parseMeta('')).toEqual({ ok: true, value: {} });
    expect(parseMeta('{"hex":"#fff","rank":3,"on":true,"tags":["a","b"]}').ok).toBe(true);
    expect(parseMeta('[]')).toEqual({ ok: false });
    expect(parseMeta('not json')).toEqual({ ok: false });
    expect(parseMeta('{"nested":{"x":1}}')).toEqual({ ok: false });
  });
  it('sortOrder is a bounded float-free integer', () => {
    expect(parseSortOrder('')).toBe(100);
    expect(parseSortOrder('250')).toBe(250);
    expect(parseSortOrder('2.5')).toBeUndefined();
    expect(parseSortOrder('99999')).toBeUndefined();
  });
});

describe('lookup type builders', () => {
  it('create validates code + name', () => {
    expect(buildCreateType({ code: 'crop_stage', defaultName: 'Crop stage', reason: 'seed vocab' }).ok).toBe(true);
    expect(buildCreateType({ code: 'BadCode', defaultName: 'x', reason: 'a reason' })).toEqual({ ok: false, error: 'code' });
    expect(buildCreateType({ code: 'crop_stage', defaultName: '', reason: 'a reason' })).toEqual({ ok: false, error: 'defaultName' });
  });
  it('update', () => {
    expect(buildUpdateType({ defaultName: 'Renamed', reason: 'fix label' }).ok).toBe(true);
  });
});

describe('lookup value builders', () => {
  it('create validates type/value code + meta', () => {
    const r = buildCreateValue({ typeCode: 'crop_stage', code: 'sowing', defaultName: 'Sowing', meta: '{"order":1}', sortOrder: '10', reason: 'add value' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ typeCode: 'crop_stage', code: 'sowing', sortOrder: 10 });
    expect(buildCreateValue({ typeCode: 'crop_stage', code: 'BAD CODE', defaultName: 'x', reason: 'a reason' })).toEqual({ ok: false, error: 'code' });
    expect(buildCreateValue({ typeCode: 'crop_stage', code: 'sowing', defaultName: 'x', meta: '[1]', reason: 'a reason' })).toEqual({ ok: false, error: 'meta' });
  });
  it('update + setActive', () => {
    expect(buildUpdateValue({ defaultName: 'Sowing', meta: '{}', sortOrder: '5', reason: 'tweak' }).ok).toBe(true);
    expect(buildSetActive({ isActive: 'false', reason: 'retire it' })).toEqual({ ok: true, value: { isActive: false, reason: 'retire it' } });
    expect(buildSetActive({ isActive: 'maybe', reason: 'x y z' })).toEqual({ ok: false, error: 'isActive' });
  });
});

describe('category builders', () => {
  it('create validates slug + commerceKind + minAge', () => {
    const r = buildCreateCategory({ parentId: '', slug: 'wheat', defaultName: 'Wheat', commerceKind: 'goods', requiresLicense: 'false', minAge: '', sortOrder: '100', reason: 'add cat' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ parentId: null, slug: 'wheat', commerceKind: 'goods', minAge: null });
    expect(buildCreateCategory({ slug: 'BAD SLUG', defaultName: 'x', reason: 'a reason' })).toEqual({ ok: false, error: 'slug' });
    expect(buildCreateCategory({ slug: 'wheat', defaultName: 'x', commerceKind: 'nope', reason: 'a reason' })).toEqual({ ok: false, error: 'commerceKind' });
    expect(buildCreateCategory({ slug: 'wheat', defaultName: 'x', minAge: '200', reason: 'a reason' })).toEqual({ ok: false, error: 'minAge' });
  });
  it('update + move', () => {
    expect(buildUpdateCategory({ defaultName: 'Wheat', commerceKind: 'goods', requiresLicense: 'true', sortOrder: '50', reason: 'edit' }).ok).toBe(true);
    expect(buildMove({ newParentId: '', reason: 'to root' })).toEqual({ ok: true, value: { newParentId: null, reason: 'to root' } });
    expect(buildMove({ newParentId: 'bad', reason: 'x y z' })).toEqual({ ok: false, error: 'newParentId' });
  });
  it('commerceKindKey + COMMERCE_KINDS', () => {
    expect(commerceKindKey('rental')).toBe('rental');
    expect(commerceKindKey('weird')).toBe('goods');
    expect(COMMERCE_KINDS).toContain('input_regulated');
  });
});
