// Pure unit tests for government-id validation + masking (no I/O, no DB). These guard the PII boundary:
// the raw id is only ever an input; what we persist/return is masked + last-4.
import {
  isValidAadhaar, isValidPan, isValidId, maskAadhaar, maskPan, maskId, last4,
} from '../domain/id-masking';

describe('id-masking · Aadhaar (Verhoeff)', () => {
  // 999999990019 is a well-known UIDAI Verhoeff-valid test Aadhaar.
  it('accepts a Verhoeff-valid 12-digit Aadhaar', () => {
    expect(isValidAadhaar('999999990019')).toBe(true);
  });
  it('tolerates internal whitespace (grouped entry)', () => {
    expect(isValidAadhaar('9999 9999 0019')).toBe(true);
  });
  it('rejects a number whose checksum is wrong', () => {
    expect(isValidAadhaar('999999990010')).toBe(false); // last digit broken
  });
  it('rejects wrong length / non-digits', () => {
    expect(isValidAadhaar('12345678901')).toBe(false);   // 11 digits
    expect(isValidAadhaar('1234567890123')).toBe(false);  // 13 digits
    expect(isValidAadhaar('abcd99990019')).toBe(false);
    expect(isValidAadhaar('')).toBe(false);
    expect(isValidAadhaar(undefined as unknown as string)).toBe(false);
  });
});

describe('id-masking · PAN', () => {
  it('accepts a structurally valid PAN (case-insensitive)', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(isValidPan('  ABCDE1234F  ')).toBe(true);
  });
  it('rejects malformed PANs', () => {
    expect(isValidPan('ABCD1234F')).toBe(false);   // 4 letters
    expect(isValidPan('ABCDE12345')).toBe(false);  // trailing digit not letter
    expect(isValidPan('ABCDEF234F')).toBe(false);  // letter where digit expected
    expect(isValidPan('')).toBe(false);
  });
});

describe('id-masking · isValidId dispatch', () => {
  it('routes by docType', () => {
    expect(isValidId('aadhaar', '999999990019')).toBe(true);
    expect(isValidId('pan', 'ABCDE1234F')).toBe(true);
    expect(isValidId('aadhaar', 'ABCDE1234F')).toBe(false);
    expect(isValidId('pan', '999999990019')).toBe(false);
  });
});

describe('id-masking · masking never leaks the raw id', () => {
  it('masks Aadhaar to XXXXXXXX + last 4', () => {
    expect(maskAadhaar('999999990019')).toBe('XXXXXXXX0019');
    expect(maskAadhaar('9999 9999 0019')).toBe('XXXXXXXX0019');
    // the first 8 digits never appear in the mask
    expect(maskAadhaar('999999990019')).not.toContain('99999999');
  });
  it('masks PAN keeping only the edge letter, trailing digits + check letter', () => {
    expect(maskPan('ABCDE1234F')).toBe('AXXXX1234F');
    expect(maskPan('abcde1234f')).toBe('AXXXX1234F'); // upper-cased
    expect(maskPan('BAD')).toBe('XXXXXXXXXX');         // defensive on bad length
  });
  it('maskId dispatches by docType', () => {
    expect(maskId('aadhaar', '999999990019')).toBe('XXXXXXXX0019');
    expect(maskId('pan', 'ABCDE1234F')).toBe('AXXXX1234F');
  });
  it('last4 returns only the final four digits', () => {
    expect(last4('999999990019')).toBe('0019');
    expect(last4('9999 9999 0019')).toBe('0019');
  });
});
