// Unit tests for the PURE KYC presentation logic (screen 133).
import { kycStatusFor } from '../../features/kyc/kyc';

describe('business KYC (screen 133)', () => {
  const docs = [{ docTypeId: 'gst', status: 'verified' as const }, { docTypeId: 'pan', status: 'pending' as const }];
  it('kycStatusFor returns the submitted status, or null when none', () => {
    expect(kycStatusFor(docs, 'gst')).toBe('verified');
    expect(kycStatusFor(docs, 'pan')).toBe('pending');
    expect(kycStatusFor(docs, 'address')).toBeNull();
    expect(kycStatusFor([], 'gst')).toBeNull();
  });
});
