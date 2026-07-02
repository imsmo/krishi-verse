// Unit tests for the PURE farmer-bookings tab logic (screen 50).
import { bookingTab, filterByBookingTab, bookingTabCounts } from '../../features/labour/farmer-bookings';

const b = (status: string) => ({ status });

describe('farmer bookings (screen 50)', () => {
  it('bookingTab classifies status', () => {
    expect(bookingTab('pending')).toBe('active');
    expect(bookingTab('confirmed')).toBe('active');
    expect(bookingTab('in_progress')).toBe('active');
    expect(bookingTab('completed')).toBe('completed');
    expect(bookingTab('paid')).toBe('completed');
    expect(bookingTab('cancelled')).toBe('cancelled');
    expect(bookingTab('expired')).toBe('cancelled');
  });
  it('filter + counts', () => {
    const items = [b('pending'), b('confirmed'), b('in_progress'), b('completed'), b('paid'), b('cancelled')];
    expect(bookingTabCounts(items)).toEqual({ active: 3, completed: 2, cancelled: 1 });
    expect(filterByBookingTab(items, 'completed').length).toBe(2);
    expect(filterByBookingTab(items, 'active').map((x) => x.status)).toEqual(['pending', 'confirmed', 'in_progress']);
  });
});
