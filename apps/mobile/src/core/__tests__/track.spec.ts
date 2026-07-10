// Unit tests for the PURE track-timestamp mapping (screen 131). No React/native deps.
import { trackTimestamps, orderTimeline, trackTimestampsFromEvents, lastKnownLocation } from '../../features/orders/order-status';

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

describe('P1-1 tracking feed → timeline (real stamped per-step times)', () => {
  const feed = {
    createdAt: '2026-08-22T06:00:00Z',
    completedAt: '2026-08-25T10:00:00Z',
    orderEvents: [
      { toStatus: 'created', at: '2026-08-22T06:00:00Z' },
      { toStatus: 'confirmed', at: '2026-08-22T07:30:00Z' },
      { toStatus: 'ready', at: '2026-08-23T05:00:00Z' },
      { toStatus: 'out_for_delivery', at: '2026-08-24T08:00:00Z' },
      { toStatus: 'delivered', at: '2026-08-24T15:00:00Z' },
      { toStatus: 'completed', at: '2026-08-25T10:00:00Z' },
    ],
    shipment: { pickedUpAt: '2026-08-23T05:30:00Z', deliveredAt: '2026-08-24T15:00:00Z' },
    shipmentEvents: [
      { status: 'picked_up', at: '2026-08-23T05:30:00Z', lat: null, lng: null },
      { status: 'in_transit', at: '2026-08-24T09:00:00Z', lat: 22.31, lng: 73.18 },
      { status: 'out_for_delivery', at: '2026-08-24T13:00:00Z', lat: 22.55, lng: 72.95 },
    ],
  };

  it('maps every stamped transition to its step time (payment/seller = confirmed time)', () => {
    const ts = trackTimestampsFromEvents(feed);
    expect(ts.placed).toBe('2026-08-22T06:00:00Z');
    expect(ts.payment).toBe('2026-08-22T07:30:00Z');
    expect(ts.seller).toBe('2026-08-22T07:30:00Z');
    expect(ts.ready).toBe('2026-08-23T05:00:00Z');
    expect(ts.out_for_delivery).toBe('2026-08-24T08:00:00Z');
    expect(ts.delivered).toBe('2026-08-24T15:00:00Z');
    expect(ts.completed).toBe('2026-08-25T10:00:00Z');
  });

  it('feeds orderTimeline so out_for_delivery shows its REAL stamped time (not null §13)', () => {
    const steps = orderTimeline('out_for_delivery', trackTimestampsFromEvents(feed));
    const oor = steps.find((s) => s.key === 'out_for_delivery')!;
    expect(oor.atIso).toBe('2026-08-24T08:00:00Z');
  });

  it('falls back to shipment pickedUp/delivered when the order-event is absent', () => {
    const ts = trackTimestampsFromEvents({ orderEvents: [{ toStatus: 'created', at: 'c' }], shipment: { pickedUpAt: 'p', deliveredAt: 'd' } });
    expect(ts.ready).toBe('p');       // no 'ready' order-event → shipment.pickedUpAt
    expect(ts.delivered).toBe('d');   // no 'delivered' order-event → shipment.deliveredAt
    expect(ts.out_for_delivery).toBeNull(); // nothing stamped → null (never fabricated)
  });

  it('lastKnownLocation returns the most recent lat/lng ping, or null when none', () => {
    expect(lastKnownLocation(feed.shipmentEvents)).toEqual({ lat: 22.55, lng: 72.95, at: '2026-08-24T13:00:00Z' });
    expect(lastKnownLocation([{ status: 'picked_up', at: 'x', lat: null, lng: null }])).toBeNull();
    expect(lastKnownLocation([])).toBeNull();
    expect(lastKnownLocation(undefined)).toBeNull();
  });
});
