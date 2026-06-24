// apps/web-partner/src/test/product.spec.ts · unit tests for the pure loan-product / lender-registry helpers.
import {
  PARTNER_KINDS, isPartnerKind, partnerKindKey, formatAprBps, formatTenureMonths, parseBps, parseActiveOnly,
} from '../features/lending/product';

describe('partner kinds', () => {
  it('mirrors the API kinds + keys', () => {
    expect(PARTNER_KINDS).toEqual(['bank', 'nbfc', 'mfi', 'insurer', 'amc', 'gold_loan']);
    expect(isPartnerKind('nbfc')).toBe(true);
    expect(isPartnerKind('nope')).toBe(false);
    expect(isPartnerKind(undefined)).toBe(false);
    expect(partnerKindKey('bank')).toBe('lender.kind.bank');
    expect(partnerKindKey('nope')).toBe('lender.kind.unknown');
  });
});

describe('APR (basis points → percent, float-free)', () => {
  it('formats integer bps to 2-dp percent', () => {
    expect(formatAprBps(1250)).toBe('12.50%');
    expect(formatAprBps(1)).toBe('0.01%');
    expect(formatAprBps(0)).toBe('0.00%');
    expect(formatAprBps(10000)).toBe('100.00%');
  });
  it('null/invalid → null (caller shows a dash)', () => {
    expect(formatAprBps(null)).toBeNull();
    expect(formatAprBps(undefined)).toBeNull();
    expect(formatAprBps(-5)).toBeNull();
    expect(formatAprBps(12.5)).toBeNull();
  });
});

describe('tenure window', () => {
  it('classifies the min/max window', () => {
    expect(formatTenureMonths(6, 36)).toEqual({ kind: 'range', min: 6, max: 36 });
    expect(formatTenureMonths(6, null)).toEqual({ kind: 'min', min: 6, max: null });
    expect(formatTenureMonths(null, 36)).toEqual({ kind: 'max', min: null, max: 36 });
    expect(formatTenureMonths(null, null)).toEqual({ kind: 'none', min: null, max: null });
  });
});

describe('query parsers', () => {
  it('parseBps: digits only', () => {
    expect(parseBps('1250')).toBe(1250);
    expect(parseBps('')).toBeNull();
    expect(parseBps('12.5')).toBeNull();
    expect(parseBps('-1')).toBeNull();
  });
  it('parseActiveOnly: defaults true, explicit false opts in to inactive', () => {
    expect(parseActiveOnly(undefined)).toBe(true);
    expect(parseActiveOnly('true')).toBe(true);
    expect(parseActiveOnly('false')).toBe(false);
    expect(parseActiveOnly('0')).toBe(false);
  });
});
