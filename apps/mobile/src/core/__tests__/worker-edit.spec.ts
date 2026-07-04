// Unit tests for the PURE worker Edit-Profile logic (features/labour/worker-edit) behind screen 136. Verifies the
// two-patch split (identity vs worker prefs), required-field validation, bigint rate→paise, and language toggle.
import { buildWorkerProfileEdit, dailyRateToMinor, toggleLanguage, GENDERS, LANGUAGE_CODES } from '../../features/labour/worker-edit';

describe('dailyRateToMinor (bigint paise, no float)', () => {
  it('whole rupees → paise, rejects garbage/zero', () => {
    expect(dailyRateToMinor('400')).toBe('40000');
    expect(dailyRateToMinor('0')).toBeUndefined();
    expect(dailyRateToMinor('₹400')).toBeUndefined();
    expect(dailyRateToMinor('')).toBeUndefined();
  });
});

describe('buildWorkerProfileEdit', () => {
  it('splits into profile (name/gender/language) + worker (village/travel/rate) patches', () => {
    const r = buildWorkerProfileEdit({ fullName: 'Sunita Kumari', gender: 'female', languages: ['hi', 'gu'], villageRegionId: 'r1', travelKm: '15', dailyRateRupees: '400' });
    expect(r.ok).toBe(true);
    expect(r.profilePatch).toEqual({ fullName: 'Sunita Kumari', gender: 'female', languageCode: 'hi' });
    expect(r.workerPatch).toEqual({ villageRegionId: 'r1', travelKm: 15, minWageExpectationMinor: '40000' });
  });
  it('requires a name and a home village', () => {
    const r = buildWorkerProfileEdit({ fullName: 'A', villageRegionId: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining(['name', 'village']));
  });
  it('flags a malformed travelKm / rate but keeps the rest', () => {
    const r = buildWorkerProfileEdit({ fullName: 'Sunita', villageRegionId: 'r1', travelKm: 'abc', dailyRateRupees: 'xx' });
    expect(r.errors).toEqual(expect.arrayContaining(['travelKm', 'rate']));
    expect(r.profilePatch.fullName).toBe('Sunita');
  });
  it('omits optional fields cleanly when blank', () => {
    const r = buildWorkerProfileEdit({ fullName: 'Sunita', villageRegionId: 'r1' });
    expect(r.ok).toBe(true);
    expect(r.workerPatch).toEqual({ villageRegionId: 'r1' });
    expect(r.profilePatch.gender).toBeUndefined();
    expect(r.profilePatch.languageCode).toBeUndefined();
  });
});

describe('toggleLanguage', () => {
  it('adds/removes preserving order (primary = first)', () => {
    expect(toggleLanguage([], 'hi')).toEqual(['hi']);
    expect(toggleLanguage(['hi'], 'gu')).toEqual(['hi', 'gu']);
    expect(toggleLanguage(['hi', 'gu'], 'hi')).toEqual(['gu']);
  });
  it('exposes the launch languages + genders', () => {
    expect(LANGUAGE_CODES).toEqual(['hi', 'gu', 'en']);
    expect(GENDERS).toEqual(['female', 'male', 'other']);
  });
});
