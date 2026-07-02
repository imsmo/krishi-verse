// Unit tests for the PURE buyer-profile helper (screen 132).
import { hasVerifiedKyc } from '../../features/profile/profile';

describe('buyer business profile (screen 132)', () => {
  it('hasVerifiedKyc true only when a verified doc exists', () => {
    expect(hasVerifiedKyc([{ status: 'pending' }, { status: 'verified' }])).toBe(true);
    expect(hasVerifiedKyc([{ status: 'pending' }, { status: 'rejected' }])).toBe(false);
    expect(hasVerifiedKyc([])).toBe(false);
    expect(hasVerifiedKyc(null)).toBe(false);
    expect(hasVerifiedKyc(undefined)).toBe(false);
  });
});
