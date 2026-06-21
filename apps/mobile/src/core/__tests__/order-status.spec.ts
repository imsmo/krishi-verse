// Unit tests for the PURE order/shipment status logic (features/orders/order-status). No React/native deps
// (ui PillTone is type-only). This is the navigation-only action map that mirrors the server state machine — the
// server remains the authority, so these tests pin the UX surface, not security.
import { orderStatusTone, nextActions, isValidPodOtp, trackingSteps, TRACKING_SEQUENCE } from '../../features/orders/order-status';

describe('orderStatusTone', () => {
  it('maps lifecycle states to tones; unknown → neutral', () => {
    expect(orderStatusTone('completed')).toBe('success');
    expect(orderStatusTone('confirmed')).toBe('info');
    expect(orderStatusTone('in_transit')).toBe('accent');
    expect(orderStatusTone('cancelled')).toBe('danger');
    expect(orderStatusTone('disputed')).toBe('warning');
    expect(orderStatusTone('created')).toBe('neutral');
    expect(orderStatusTone('???')).toBe('neutral');
  });
});

describe('nextActions (seller)', () => {
  it('offers confirm/cancel on a fresh order, never a stale transition', () => {
    expect(nextActions('created', 'seller')).toEqual(['confirm', 'cancel', 'report']);
    expect(nextActions('confirmed', 'seller')).toEqual(['packed', 'cancel', 'report']);
    expect(nextActions('packed', 'seller')).toEqual(['ready', 'report']);
    expect(nextActions('ready', 'seller')).toEqual(['recordDelivery', 'report']);
  });
  it('offers complete+track after delivery, review after completion', () => {
    expect(nextActions('delivered', 'seller')).toEqual(['complete', 'track', 'report']);
    expect(nextActions('completed', 'seller')).toEqual(['review']);
  });
  it('terminal states offer nothing', () => {
    expect(nextActions('cancelled', 'seller')).toEqual([]);
    expect(nextActions('refunded', 'seller')).toEqual([]);
  });
  it('in-transit states only allow tracking + reporting (no seller transition)', () => {
    expect(nextActions('in_transit', 'seller')).toEqual(['track', 'report']);
    expect(nextActions('out_for_delivery', 'seller')).toEqual(['track', 'report']);
  });
});

describe('nextActions (buyer)', () => {
  it('a buyer never gets seller transitions (no confirm/packed/ready)', () => {
    for (const s of ['created', 'confirmed', 'packed', 'ready', 'in_transit', 'delivered', 'completed']) {
      const acts = nextActions(s, 'buyer');
      expect(acts).not.toContain('confirm');
      expect(acts).not.toContain('packed');
      expect(acts).not.toContain('ready');
      expect(acts).not.toContain('recordDelivery');
    }
  });
  it('can cancel early, complete on delivery, review when completed', () => {
    expect(nextActions('created', 'buyer')).toEqual(['cancel', 'report']);
    expect(nextActions('delivered', 'buyer')).toEqual(['complete', 'track', 'report']);
    expect(nextActions('completed', 'buyer')).toEqual(['review']);
  });
});

describe('isValidPodOtp (server contract: 4–8 digits)', () => {
  it('accepts 4–8 digit codes', () => {
    expect(isValidPodOtp('1234')).toBe(true);
    expect(isValidPodOtp('12345678')).toBe(true);
    expect(isValidPodOtp(' 4321 ')).toBe(true); // trimmed
  });
  it('rejects wrong length / non-digits / empty', () => {
    expect(isValidPodOtp('123')).toBe(false);
    expect(isValidPodOtp('123456789')).toBe(false);
    expect(isValidPodOtp('12ab')).toBe(false);
    expect(isValidPodOtp('')).toBe(false);
  });
});

describe('trackingSteps', () => {
  it('marks all steps up to and including the current one as reached', () => {
    const steps = trackingSteps('in_transit');
    const reached = steps.filter((s) => s.reached).map((s) => s.key);
    expect(reached).toEqual(['pending', 'assigned', 'pickup_scheduled', 'picked_up', 'in_transit']);
    expect(steps.find((s) => s.current)?.key).toBe('in_transit');
  });
  it('delivered marks the whole happy path reached', () => {
    expect(trackingSteps('delivered').every((s) => s.reached)).toBe(true);
  });
  it('an off-path/unknown status (failed) reaches nothing (degrade, no crash)', () => {
    const steps = trackingSteps('failed');
    expect(steps.every((s) => !s.reached)).toBe(true);
    expect(steps).toHaveLength(TRACKING_SEQUENCE.length);
  });
});
