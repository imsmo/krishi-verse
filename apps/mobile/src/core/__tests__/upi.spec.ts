// Unit tests for the PURE UPI helpers (features/profile/upi, screen 180). No React/native deps.
import { upiHandleTag, applyUpiHandle, COMMON_UPI_HANDLES } from '../../features/profile/upi';

describe('upiHandleTag', () => {
  it('returns the @handle portion', () => {
    expect(upiHandleTag('ramesh@okaxis')).toBe('@okaxis');
    expect(upiHandleTag('98765xxxxx@paytm')).toBe('@paytm');
  });
  it('returns empty when there is no handle', () => {
    expect(upiHandleTag('ramesh')).toBe('');
    expect(upiHandleTag('')).toBe('');
    expect(upiHandleTag(null)).toBe('');
  });
});

describe('applyUpiHandle', () => {
  it('appends the handle to the local part', () => {
    expect(applyUpiHandle('ramesh', '@ybl')).toBe('ramesh@ybl');
  });
  it('replaces an existing handle', () => {
    expect(applyUpiHandle('ramesh@okaxis', '@ybl')).toBe('ramesh@ybl');
  });
  it('handles empty local part', () => {
    expect(applyUpiHandle('', '@upi')).toBe('@upi');
    expect(applyUpiHandle('  ', '@upi')).toBe('@upi');
  });
});

describe('COMMON_UPI_HANDLES', () => {
  it('are @-prefixed public handles', () => {
    expect(COMMON_UPI_HANDLES.length).toBeGreaterThan(0);
    for (const h of COMMON_UPI_HANDLES) expect(h.startsWith('@')).toBe(true);
  });
});
