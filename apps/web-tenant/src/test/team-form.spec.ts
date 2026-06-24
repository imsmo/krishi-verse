// apps/web-tenant/src/test/team-form.spec.ts · unit tests for the team helpers: add-member phone validation +
// pending detection.
import { buildAddUser, isPending } from '../features/team/form';

describe('buildAddUser', () => {
  it('accepts E.164-ish phones, normalising spaces/dashes', () => {
    expect(buildAddUser({ phone: '+91 98765-43210', fullName: ' Asha ' })).toEqual({ ok: true, value: { phone: '+919876543210', fullName: 'Asha', languageCode: undefined, countryCode: undefined } });
    expect(buildAddUser({ phone: '9876543210' }).ok).toBe(true);
  });
  it('rejects malformed phones', () => {
    expect(buildAddUser({ phone: '' })).toEqual({ ok: false, error: 'phone' });
    expect(buildAddUser({ phone: '12345' })).toEqual({ ok: false, error: 'phone' });
    expect(buildAddUser({ phone: 'abcd' })).toEqual({ ok: false, error: 'phone' });
  });
});

describe('isPending', () => {
  it('true when not yet approved', () => {
    expect(isPending({ approvedAt: null })).toBe(true);
    expect(isPending({ approvedAt: '2026-01-01T00:00:00Z' })).toBe(false);
  });
});
