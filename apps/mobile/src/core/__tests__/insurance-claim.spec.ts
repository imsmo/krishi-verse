// Unit tests for the PURE File-Insurance-Claim logic (features/labour/insurance-claim) behind screen 146.
import { CLAIM_TYPES, CLAIM_DOCS, normalizeClaimText, isIncidentDateValid, canSubmitClaim } from '../../features/labour/insurance-claim';

describe('constants', () => {
  it('lists the two claim types + three docs in design order', () => {
    expect(CLAIM_TYPES.map((c) => c.key)).toEqual(['injury', 'death']);
    expect(CLAIM_DOCS.map((d) => d.key)).toEqual(['fir', 'hospital', 'disability']);
    expect(CLAIM_DOCS.filter((d) => d.required).map((d) => d.key)).toEqual(['hospital', 'disability']);
  });
});

describe('normalizeClaimText', () => {
  it('trims/collapses, caps 2000, empty → null', () => {
    expect(normalizeClaimText('  cut   on hand ')).toBe('cut on hand');
    expect(normalizeClaimText('')).toBeNull();
    expect(normalizeClaimText(null)).toBeNull();
    expect(normalizeClaimText('x'.repeat(2500))!.length).toBe(2000);
  });
});

describe('isIncidentDateValid', () => {
  it('accepts YYYY-MM-DD only', () => {
    expect(isIncidentDateValid('2026-08-22')).toBe(true);
    expect(isIncidentDateValid('22-08-2026')).toBe(false);
    expect(isIncidentDateValid('')).toBe(false);
    expect(isIncidentDateValid(null)).toBe(false);
  });
});

describe('canSubmitClaim', () => {
  it('needs a type + valid date + ≥10-char description', () => {
    expect(canSubmitClaim('injury', '2026-08-22', 'Deep cut on right hand while harvesting')).toBe(true);
    expect(canSubmitClaim('injury', '2026-08-22', 'short')).toBe(false);
    expect(canSubmitClaim('injury', 'bad-date', 'a long enough description here')).toBe(false);
    expect(canSubmitClaim(null, '2026-08-22', 'a long enough description here')).toBe(false);
    expect(canSubmitClaim('nope' as never, '2026-08-22', 'a long enough description here')).toBe(false);
  });
});
