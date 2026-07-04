// Unit tests for the PURE Wage-Dispute logic (features/labour/wage-dispute) behind screen 143.
import { DISPUTE_REASONS, DISPUTE_SEVERITY, normalizeDisputeText, canSubmitDispute } from '../../features/labour/wage-dispute';

describe('DISPUTE_REASONS', () => {
  it('are the five design reasons in order', () => {
    expect(DISPUTE_REASONS.map((r) => r.key)).toEqual(['less_wage', 'extra_hours', 'not_paid', 'behavior', 'amenities']);
    expect(DISPUTE_SEVERITY).toBe('P1');
  });
});

describe('normalizeDisputeText', () => {
  it('trims + collapses, caps 1000, empty → null', () => {
    expect(normalizeDisputeText('  paid   less ')).toBe('paid less');
    expect(normalizeDisputeText('')).toBeNull();
    expect(normalizeDisputeText(null)).toBeNull();
    expect(normalizeDisputeText('x'.repeat(1200))!.length).toBe(1000);
  });
});

describe('canSubmitDispute', () => {
  it('needs a reason + a description of ≥10 chars', () => {
    expect(canSubmitDispute('less_wage', 'Paid 300 not 400')).toBe(true);
    expect(canSubmitDispute('less_wage', 'short')).toBe(false);
    expect(canSubmitDispute(null, 'a long enough description here')).toBe(false);
    expect(canSubmitDispute('nope' as never, 'a long enough description here')).toBe(false);
  });
});
