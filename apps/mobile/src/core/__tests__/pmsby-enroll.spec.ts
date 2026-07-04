// Unit tests for the PURE PMSBY-enrolment logic (features/labour/pmsby-enroll) behind screen 145.
import {
  NOMINEE_RELATIONSHIPS, PMSBY_PREMIUM_MINOR, normalizeNomineeName, normalizeAadhaar,
  isAadhaarValidOptional, canEnroll, pmsbyEligibility,
} from '../../features/labour/pmsby-enroll';

describe('constants', () => {
  it('lists the seven nominee relationships in design order', () => {
    expect(NOMINEE_RELATIONSHIPS).toEqual(['spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'other']);
  });
  it('keeps the ₹20 premium as bigint minor', () => { expect(PMSBY_PREMIUM_MINOR).toBe('2000'); });
});

describe('normalizeNomineeName', () => {
  it('trims/collapses, caps 100, empty → null', () => {
    expect(normalizeNomineeName('  Sunita   Devi ')).toBe('Sunita Devi');
    expect(normalizeNomineeName('')).toBeNull();
    expect(normalizeNomineeName(null)).toBeNull();
    expect(normalizeNomineeName('x'.repeat(150))!.length).toBe(100);
  });
});

describe('normalizeAadhaar / isAadhaarValidOptional', () => {
  it('keeps 12 digits only; valid when blank or exactly 12', () => {
    expect(normalizeAadhaar('1234-5678-9012')).toBe('123456789012');
    expect(normalizeAadhaar('12 34 5678 9012 999')).toBe('123456789012');
    expect(isAadhaarValidOptional('')).toBe(true);
    expect(isAadhaarValidOptional('123456789012')).toBe(true);
    expect(isAadhaarValidOptional('12345')).toBe(false);
  });
});

describe('canEnroll', () => {
  it('needs a name + valid relationship + well-formed optional Aadhaar', () => {
    expect(canEnroll('Sunita', 'spouse')).toBe(true);
    expect(canEnroll('Sunita', 'spouse', '123456789012')).toBe(true);
    expect(canEnroll('Sunita', 'spouse', '12345')).toBe(false);
    expect(canEnroll('', 'spouse')).toBe(false);
    expect(canEnroll('Sunita', null)).toBe(false);
    expect(canEnroll('Sunita', 'cousin' as never)).toBe(false);
  });
});

describe('pmsbyEligibility', () => {
  const worker = { ageVerified18: true } as never;
  const bank = [{ accountKind: 'bank' }] as never;
  const docTypes = [{ id: 'dt1', code: 'aadhaar' }] as never;
  const kycOk = [{ docTypeId: 'dt1', status: 'verified' }] as never;

  it('qualifies only when age + bank + verified Aadhaar all hold', () => {
    expect(pmsbyEligibility(worker, bank, docTypes, kycOk).qualifies).toBe(true);
    expect(pmsbyEligibility({ ageVerified18: false } as never, bank, docTypes, kycOk).qualifies).toBe(false);
    expect(pmsbyEligibility(worker, [] as never, docTypes, kycOk).qualifies).toBe(false);
    expect(pmsbyEligibility(worker, bank, docTypes, [{ docTypeId: 'dt1', status: 'pending' }] as never).aadhaarOk).toBe(false);
  });
  it('degrades to all-false on empty inputs', () => {
    expect(pmsbyEligibility(null, null, null, null)).toEqual({ ageOk: false, bankOk: false, aadhaarOk: false, qualifies: false });
  });
});
