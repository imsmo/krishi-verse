// Unit tests for the PURE worker job-offer logic (screen 27).
import { respondWindow, wageAboveMinMinor } from '../../features/labour/offer';

describe('job offer (screen 27)', () => {
  const now = Date.parse('2026-08-15T13:06:00Z');
  it('respondWindow: remaining h/m, or expired', () => {
    expect(respondWindow('2026-08-15T16:30:00Z', now)).toEqual({ expired: false, hoursLeft: 3, minutesLeft: 24 });
    expect(respondWindow('2026-08-15T13:00:00Z', now)).toEqual({ expired: true, hoursLeft: 0, minutesLeft: 0 });
    expect(respondWindow(null, now)).toBeNull();
    expect(respondWindow('nope', now)).toBeNull();
  });
  it('wageAboveMinMinor: offered − min when higher, else null', () => {
    expect(wageAboveMinMinor('40000', '35000')).toBe('5000'); // ₹50 above ₹350
    expect(wageAboveMinMinor('35000', '35000')).toBeNull();
    expect(wageAboveMinMinor('30000', '35000')).toBeNull();
    expect(wageAboveMinMinor('x', '35000')).toBeNull();
  });
});
