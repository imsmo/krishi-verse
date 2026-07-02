// Unit tests for the PURE track-timestamp mapping (screen 131). No React/native deps.
import { trackTimestamps, orderTimeline } from '../../features/orders/order-status';

describe('track order (screen 131)', () => {
  it('trackTimestamps maps only the real contract fields, null otherwise', () => {
    const ts = trackTimestamps(
      { createdAt: '2026-08-22T06:12:00Z', completedAt: null },
      { pickedUpAt: '2026-08-23T04:00:00Z', deliveredAt: null },
    );
    expect(ts).toEqual({ placed: '2026-08-22T06:12:00Z', ready: '2026-08-23T04:00:00Z', delivered: null, completed: null });
  });
  it('trackTimestamps degrades to all-null when nothing is available', () => {
    expect(trackTimestamps(null, null)).toEqual({ placed: null, ready: null, delivered: null, completed: null });
  });
  it('feeds orderTimeline: picked-up order → ready done, out_for_delivery active, real ready time attached', () => {
    const ts = trackTimestamps({ createdAt: '2026-08-22T06:12:00Z' }, { pickedUpAt: '2026-08-23T04:00:00Z' });
    const steps = orderTimeline('picked_up', ts);
    const ready = steps.find((s) => s.key === 'ready')!;
    const oor = steps.find((s) => s.key === 'out_for_delivery')!;
    expect(ready.state).toBe('done');
    expect(ready.atIso).toBe('2026-08-23T04:00:00Z');
    expect(oor.state).toBe('active');
  });
});
