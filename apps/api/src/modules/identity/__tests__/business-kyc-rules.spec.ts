// Pure tests for the P0-5 business-KYC rules: GSTIN/PAN shape validation + masking (never echo the raw id) +
// GSTIN↔PAN consistency (the GSTIN embeds the holder's PAN at chars 3-12).
import { isValidGstin, isValidPan, maskGstin, maskPan, gstinPanConsistent, isBusinessType, BUSINESS_TYPES } from '../domain/business-kyc.rules';

const PAN = 'ABCDE1234F';
const GSTIN = `27ABCDE1234F1Z5`; // state 27 + PAN + entity 1 + Z + checksum 5

describe('PAN validation + masking', () => {
  it('accepts a well-formed PAN and rejects malformed ones', () => {
    expect(isValidPan(PAN)).toBe(true);
    expect(isValidPan(' abcde1234f ')).toBe(true);   // trimmed + upper-cased
    expect(isValidPan('ABCD1234F')).toBe(false);      // 9 chars
    expect(isValidPan('ABCDE12345')).toBe(false);     // last must be a letter
    expect(isValidPan('')).toBe(false);
  });
  it('masks to first-2 + last-2, hiding the middle', () => {
    expect(maskPan(PAN)).toBe('AB****4F');
    expect(maskPan(PAN)).not.toContain('CDE123');     // middle never leaks
  });
  it('throws rather than storing an invalid PAN', () => { expect(() => maskPan('nope')).toThrow(); });
});

describe('GSTIN validation + masking', () => {
  it('accepts a valid GSTIN and rejects malformed ones', () => {
    expect(isValidGstin(GSTIN)).toBe(true);
    expect(isValidGstin('27ABCDE1234F1Z')).toBe(false); // 14 chars
    expect(isValidGstin('27ABCDE1234F1A5')).toBe(false); // 13th char must be Z
  });
  it('masks to state code + last-4, hiding the embedded PAN', () => {
    expect(maskGstin(GSTIN)).toBe('27******F1Z5');     // state 27 + 6× mask + last-4
    expect(maskGstin(GSTIN)).not.toContain('ABCDE');   // embedded PAN never leaks
  });
  it('throws rather than storing an invalid GSTIN', () => { expect(() => maskGstin('bad')).toThrow(); });
});

describe('gstinPanConsistent', () => {
  it('true when the GSTIN embeds the same PAN', () => { expect(gstinPanConsistent(GSTIN, PAN)).toBe(true); });
  it('false when the PANs differ', () => { expect(gstinPanConsistent(GSTIN, 'ZZZZZ9999Z')).toBe(false); });
  it('false when either value is malformed', () => { expect(gstinPanConsistent('bad', PAN)).toBe(false); });
});

describe('business type vocabulary', () => {
  it('recognises the 9 allowed types and rejects others', () => {
    expect(BUSINESS_TYPES).toHaveLength(9);
    expect(isBusinessType('fpo')).toBe(true);
    expect(isBusinessType('pvt_ltd')).toBe(true);
    expect(isBusinessType('sole')).toBe(false);
  });
});
