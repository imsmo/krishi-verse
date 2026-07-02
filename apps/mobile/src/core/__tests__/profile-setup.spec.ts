// Unit tests for the PURE profile-setup logic (screen 05). Validators + write-assembly only — no I/O.
import {
  isValidPincode, isValidUpi, buildSetupWrites, FARM_SIZES, EMPTY_SETUP_FORM, type ProfileSetupForm,
} from '../../features/onboarding/profile-setup';

const base: ProfileSetupForm = { ...EMPTY_SETUP_FORM, fullName: 'Ramesh Patel' };

describe('profile-setup validators', () => {
  it('accepts valid Indian pincodes and rejects junk', () => {
    expect(isValidPincode('388001')).toBe(true);
    expect(isValidPincode('110001')).toBe(true);
    expect(isValidPincode('012345')).toBe(false); // leading 0
    expect(isValidPincode('38800')).toBe(false);  // 5 digits
    expect(isValidPincode('3880012')).toBe(false); // 7 digits
    expect(isValidPincode('abc123')).toBe(false);
  });

  it('accepts valid UPI VPAs and rejects malformed ones', () => {
    expect(isValidUpi('ramesh@okaxis')).toBe(true);
    expect(isValidUpi('ramesh.patel-1@ybl')).toBe(true);
    expect(isValidUpi('ramesh')).toBe(false);      // no @psp
    expect(isValidUpi('@okaxis')).toBe(false);     // empty handle
    expect(isValidUpi('ramesh@')).toBe(false);     // empty psp
  });

  it('exposes exactly the three design farm sizes in order', () => {
    expect([...FARM_SIZES]).toEqual(['small', 'medium', 'large']);
  });
});

describe('buildSetupWrites', () => {
  it('requires a non-empty name', () => {
    expect(buildSetupWrites({ ...base, fullName: '   ' })).toMatchObject({ ok: false, reason: 'name' });
  });

  it('rejects a too-long name', () => {
    expect(buildSetupWrites({ ...base, fullName: 'x'.repeat(201) })).toMatchObject({ ok: false, reason: 'name' });
  });

  it('builds a profile patch with trimmed name (+ photo when present)', () => {
    const w = buildSetupWrites({ ...base, fullName: '  Ramesh  ', photoMediaId: 'media_1' });
    expect(w.ok).toBe(true);
    expect(w.profilePatch).toEqual({ fullName: 'Ramesh', photoMediaId: 'media_1' });
  });

  it('omits photoMediaId when none uploaded', () => {
    const w = buildSetupWrites({ ...base });
    expect(w.profilePatch).toEqual({ fullName: 'Ramesh Patel' });
  });

  it('validates optional pincode and UPI only when provided', () => {
    expect(buildSetupWrites({ ...base, pincode: '12' })).toMatchObject({ ok: false, reason: 'pincode' });
    expect(buildSetupWrites({ ...base, upiId: 'nope' })).toMatchObject({ ok: false, reason: 'upi' });
    expect(buildSetupWrites({ ...base, pincode: '', upiId: '' }).ok).toBe(true);
  });

  it('passes UPI through and carries extras (no server contract yet) verbatim', () => {
    const w = buildSetupWrites({ ...base, village: 'Anand', pincode: '388001', farmSize: 'medium', upiId: 'ramesh@okaxis', gps: { lat: 22.5, lng: 72.9 } });
    expect(w.ok).toBe(true);
    expect(w.upiId).toBe('ramesh@okaxis');
    expect(w.extras).toEqual({ village: 'Anand', pincode: '388001', farmSize: 'medium', gps: { lat: 22.5, lng: 72.9 } });
  });
});
