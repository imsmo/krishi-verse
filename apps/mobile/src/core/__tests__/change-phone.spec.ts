// Unit tests for the PURE change-phone helpers (features/system/change-phone, screen 176). No RN deps.
import { CHANGE_PHONE_REASONS, reasonLabelKey, isValidNewMobile, normalizeNewMobile } from '../../features/system/change-phone';

describe('reasons', () => {
  it('has the three fixed reasons with stable label keys', () => {
    expect(CHANGE_PHONE_REASONS).toEqual(['lost', 'sim', 'preference']);
    expect(reasonLabelKey('lost')).toBe('changePhone.reason.lost');
    expect(reasonLabelKey('sim')).toBe('changePhone.reason.sim');
  });
});

describe('isValidNewMobile', () => {
  it('accepts a 10-digit 6–9 number, tolerating separators', () => {
    expect(isValidNewMobile('9876512340')).toBe(true);
    expect(isValidNewMobile('98765 12340')).toBe(true);
    expect(isValidNewMobile('98765-12340')).toBe(true);
  });
  it('rejects wrong length / leading digit / junk', () => {
    expect(isValidNewMobile('12345')).toBe(false);
    expect(isValidNewMobile('5876512340')).toBe(false); // starts < 6
    expect(isValidNewMobile('98765123400')).toBe(false); // 11 digits
    expect(isValidNewMobile('')).toBe(false);
    expect(isValidNewMobile(null)).toBe(false);
  });
});

describe('normalizeNewMobile', () => {
  it('returns bare 10 digits when valid, else empty', () => {
    expect(normalizeNewMobile('98765 12340')).toBe('9876512340');
    expect(normalizeNewMobile('bad')).toBe('');
  });
});
