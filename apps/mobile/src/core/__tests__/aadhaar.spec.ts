// Unit tests for the PURE Aadhaar helpers (features/kyc/aadhaar, screen 72). No React/native deps.
// The raw number never leaves component state except to the eKYC start endpoint; these helpers only
// normalise/format/mask + do a client-side Verhoeff pre-check (the server/UIDAI is the real authority).
import { normalizeAadhaar, formatAadhaar, isAadhaarComplete, isValidAadhaar, maskAadhaar, verhoeffValid } from '../../features/kyc/aadhaar';

// 234123412346 and 999888777669 carry a valid Verhoeff check digit (generated with the UIDAI scheme).
const VALID = '234123412346';

describe('normalizeAadhaar / formatAadhaar', () => {
  it('keeps digits only, capped at 12', () => {
    expect(normalizeAadhaar('2341-2341 2346')).toBe(VALID);
    expect(normalizeAadhaar('2341 2341 2346 9999')).toBe(VALID); // capped
    expect(normalizeAadhaar('abc12')).toBe('12');
    expect(normalizeAadhaar('')).toBe('');
  });
  it('groups into blocks of four for display', () => {
    expect(formatAadhaar('234123412346')).toBe('2341 2341 2346');
    expect(formatAadhaar('23412')).toBe('2341 2');
    expect(formatAadhaar('2341')).toBe('2341');
  });
});

describe('isAadhaarComplete', () => {
  it('is true only at exactly 12 digits', () => {
    expect(isAadhaarComplete(VALID)).toBe(true);
    expect(isAadhaarComplete('23412341234')).toBe(false);
    expect(isAadhaarComplete('')).toBe(false);
  });
});

describe('verhoeffValid / isValidAadhaar', () => {
  it('accepts a checksum-valid 12-digit number starting 2–9', () => {
    expect(verhoeffValid(VALID)).toBe(true);
    expect(isValidAadhaar(VALID)).toBe(true);
    expect(isValidAadhaar('999888777669')).toBe(true);
  });
  it('rejects a bad checksum', () => {
    expect(verhoeffValid('234123412340')).toBe(false);
    expect(isValidAadhaar('234123412340')).toBe(false);
  });
  it('rejects numbers starting with 0 or 1 (UIDAI never issues them)', () => {
    expect(isValidAadhaar('034123412346')).toBe(false);
    expect(isValidAadhaar('134123412346')).toBe(false);
  });
  it('rejects wrong length / non-numeric', () => {
    expect(isValidAadhaar('2341234123')).toBe(false);
    expect(verhoeffValid('12x4')).toBe(false);
  });
});

describe('maskAadhaar (PII-safe — last 4 only)', () => {
  it('shows only the last four digits', () => {
    expect(maskAadhaar(VALID)).toBe('•••• •••• 2346');
  });
  it('returns empty when not a full number (never a partial leak)', () => {
    expect(maskAadhaar('2341')).toBe('');
    expect(maskAadhaar('')).toBe('');
  });
});
