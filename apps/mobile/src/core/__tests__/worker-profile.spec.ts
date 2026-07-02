// Unit tests for the PURE worker-profile presenters (screen 25).
import { workerYears, skillLabels, regionName, compactLakh } from '../../features/labour/worker-profile';

describe('worker profile (screen 25)', () => {
  const now = Date.parse('2026-08-15T00:00:00Z');
  it('workerYears floors whole years, null on missing/bad/future', () => {
    expect(workerYears('2023-06-01T00:00:00Z', now)).toBe(3);
    expect(workerYears('2026-06-01T00:00:00Z', now)).toBe(0);
    expect(workerYears(null, now)).toBeNull();
    expect(workerYears('2027-01-01T00:00:00Z', now)).toBeNull();
  });
  it('skillLabels maps known ids in order, drops unknown/empty', () => {
    const skills = [{ id: 's1', name: 'Sowing' }, { id: 's2', name: 'Weeding' }];
    expect(skillLabels(skills, ['s2', 's1'])).toEqual(['Weeding', 'Sowing']);
    expect(skillLabels(skills, ['s1', 'x'])).toEqual(['Sowing']);
    expect(skillLabels(skills, undefined)).toEqual([]);
  });
  it('regionName resolves or null', () => {
    const regions = [{ id: 'r1', name: 'Sojitra' }];
    expect(regionName(regions, 'r1')).toBe('Sojitra');
    expect(regionName(regions, 'r9')).toBeNull();
    expect(regionName(regions, null)).toBeNull();
  });
  it('compactLakh: lakh/crore compaction, plain below 1L, — on bad', () => {
    expect(compactLakh('9700000')).toBe('₹97,000'); // below 1L → plain
    expect(compactLakh('20000000')).toBe('₹2.00L'); // ₹2,00,000
    expect(compactLakh('1500000000')).toBe('₹1.50Cr'); // ₹1.5Cr
    expect(compactLakh('845000')).toBe('₹8,450');
    expect(compactLakh(null)).toBe('—');
    expect(compactLakh('abc')).toBe('—');
  });
});
