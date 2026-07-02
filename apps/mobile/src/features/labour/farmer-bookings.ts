// apps/mobile/src/features/labour/farmer-bookings.ts · PURE tab logic for the employer "My Worker Bookings" screen
// (screen 50). No React / no SDK I/O → unit-tested. Classifies a labour booking's status into Active / Completed /
// Cancelled and counts each. Only shapes what the server returned; the SERVER owns the booking lifecycle.

export type BookingTab = 'active' | 'completed' | 'cancelled';
export const BOOKING_TABS: readonly BookingTab[] = ['active', 'completed', 'cancelled'];

/** Which tab a booking status belongs to. Pure. */
export function bookingTab(status: string): BookingTab {
  switch (status) {
    case 'completed': case 'paid': return 'completed';
    case 'cancelled': case 'expired': case 'rejected': return 'cancelled';
    default: return 'active'; // pending / open / confirmed / accepted / in_progress / unknown
  }
}

/** Bookings belonging to a tab (order preserved). Pure. */
export function filterByBookingTab<T extends { status: string }>(items: readonly T[], tab: BookingTab): T[] {
  return (items ?? []).filter((b) => bookingTab(b.status) === tab);
}

/** Live counts per tab. Pure. */
export function bookingTabCounts<T extends { status: string }>(items: readonly T[]): Record<BookingTab, number> {
  const out: Record<BookingTab, number> = { active: 0, completed: 0, cancelled: 0 };
  for (const b of items ?? []) out[bookingTab(b.status)] += 1;
  return out;
}
