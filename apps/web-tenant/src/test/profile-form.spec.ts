// apps/web-tenant/src/test/profile-form.spec.ts · unit tests for the profile/KYC helpers: profile-PATCH validation
// (blanks dropped, no-op rejected, field validation) + KYC status key mapping.
import { buildProfilePatch, kycStatusKey } from '../features/profile/form';

describe('buildProfilePatch', () => {
  it('assembles only the non-blank fields', () => {
    expect(buildProfilePatch({ fullName: '  Asha Devi  ', languageCode: 'hi' }))
      .toEqual({ ok: true, value: { fullName: 'Asha Devi', languageCode: 'hi' } });
  });
  it('accepts a valid email / dob / gender / photo', () => {
    expect(buildProfilePatch({ email: 'a@b.co', dob: '1990-05-01', gender: 'female', photoMediaId: 'm1' }))
      .toEqual({ ok: true, value: { email: 'a@b.co', dob: '1990-05-01', gender: 'female', photoMediaId: 'm1' } });
  });
  it('rejects a no-op (all blank)', () => {
    expect(buildProfilePatch({ fullName: '   ', email: '' })).toEqual({ ok: false, error: 'empty' });
  });
  it('rejects a malformed email', () => {
    expect(buildProfilePatch({ email: 'not-an-email' })).toEqual({ ok: false, error: 'email' });
  });
  it('rejects a malformed dob', () => {
    expect(buildProfilePatch({ dob: '01/05/1990' })).toEqual({ ok: false, error: 'dob' });
    expect(buildProfilePatch({ dob: '1990-13-99' })).toEqual({ ok: false, error: 'dob' });
  });
  it('rejects an unknown gender / language', () => {
    expect(buildProfilePatch({ gender: 'robot' })).toEqual({ ok: false, error: 'gender' });
    expect(buildProfilePatch({ languageCode: 'fr' })).toEqual({ ok: false, error: 'language' });
  });
});

describe('kycStatusKey', () => {
  it('passes through known statuses', () => {
    expect(kycStatusKey('verified')).toBe('verified');
    expect(kycStatusKey('rejected')).toBe('rejected');
    expect(kycStatusKey('expired')).toBe('expired');
  });
  it('falls back to pending for unknown/empty', () => {
    expect(kycStatusKey('weird')).toBe('pending');
    expect(kycStatusKey(null)).toBe('pending');
    expect(kycStatusKey(undefined)).toBe('pending');
  });
});
