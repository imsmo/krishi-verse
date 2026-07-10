// core/jobs/__tests__/date-window.spec.ts · pure clock-injected date-window helper.
import { previousUtcDayWindow } from '../date-window';

describe('previousUtcDayWindow', () => {
  it('returns yesterday\'s UTC calendar day as [from, to)', () => {
    expect(previousUtcDayWindow(new Date('2026-07-10T02:00:00Z'))).toEqual({ from: '2026-07-09', to: '2026-07-10' });
  });

  it('is stable regardless of time-of-day (only the calendar date matters)', () => {
    expect(previousUtcDayWindow(new Date('2026-07-10T23:59:59Z'))).toEqual({ from: '2026-07-09', to: '2026-07-10' });
    expect(previousUtcDayWindow(new Date('2026-07-10T00:00:00Z'))).toEqual({ from: '2026-07-09', to: '2026-07-10' });
  });

  it('rolls correctly across a month/year boundary', () => {
    expect(previousUtcDayWindow(new Date('2026-01-01T05:00:00Z'))).toEqual({ from: '2025-12-31', to: '2026-01-01' });
    expect(previousUtcDayWindow(new Date('2026-03-01T05:00:00Z'))).toEqual({ from: '2026-02-28', to: '2026-03-01' });
  });
});
