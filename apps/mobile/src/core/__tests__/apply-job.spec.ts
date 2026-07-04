// Unit tests for the PURE Apply-for-Job logic (features/labour/apply-job) behind screen 140.
import { normalizeApplyNote, canApply } from '../../features/labour/apply-job';

describe('normalizeApplyNote', () => {
  it('trims + collapses whitespace, caps length, empty → null', () => {
    expect(normalizeApplyNote('  I can   reach by 6:45 ')).toBe('I can reach by 6:45');
    expect(normalizeApplyNote('')).toBeNull();
    expect(normalizeApplyNote(null)).toBeNull();
    expect(normalizeApplyNote('x'.repeat(400))!.length).toBe(300);
  });
});

describe('canApply', () => {
  it('allows only open/pending bookings', () => {
    expect(canApply('open')).toBe(true);
    expect(canApply('pending')).toBe(true);
    expect(canApply('confirmed')).toBe(false);
    expect(canApply('cancelled')).toBe(false);
    expect(canApply(null)).toBe(false);
  });
});
