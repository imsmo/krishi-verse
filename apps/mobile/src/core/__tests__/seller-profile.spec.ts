// Unit tests for the PURE seller-profile logic (screen 100). No React/native deps.
import { yearsOnKv } from '../../features/buyer/seller-profile';

describe('seller-profile (screen 100)', () => {
  const now = Date.parse('2026-07-01T00:00:00Z');
  it('yearsOnKv floors whole years from memberSince', () => {
    expect(yearsOnKv('2024-01-15T00:00:00Z', now)).toBe(2); // ~2.5y → 2
    expect(yearsOnKv('2026-01-01T00:00:00Z', now)).toBe(0); // < 1y → 0
  });
  it('yearsOnKv returns null for missing/bad/future dates', () => {
    expect(yearsOnKv(null, now)).toBeNull();
    expect(yearsOnKv(undefined, now)).toBeNull();
    expect(yearsOnKv('not-a-date', now)).toBeNull();
    expect(yearsOnKv('2027-01-01T00:00:00Z', now)).toBeNull(); // future → null, never negative
  });
});
