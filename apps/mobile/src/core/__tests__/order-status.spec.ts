// Unit tests for the PURE order/shipment status logic (features/orders/order-status). No React/native deps
// (ui PillTone is type-only). This is the navigation-only action map that mirrors the server state machine — the
// server remains the authority, so these tests pin the UX surface, not security.
import { orderStatusTone, nextActions, isValidPodOtp, trackingSteps, TRACKING_SEQUENCE, matchesOrderFilter, orderProgress, orderListCta, orderTimeline, orderBannerKey, ORDER_TIMELINE_STEPS, sellerOrderTab, matchesSellerTab, sellerOrderStats, sellerNetMinor, decisionMinutesLeft, buyerOrderTab, matchesBuyerTab, buyerOrderCounts, counterpartyLabel } from '../../features/orders/order-status';

describe('counterpartyLabel (screen 22 — never render a raw userId)', () => {
  it('returns null for a raw UUID counterparty (so the card falls back to the order #)', () => {
    expect(counterpartyLabel('3f1a2b4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d')).toBeNull();
    expect(counterpartyLabel('3F1A2B4C-5D6E-4A7B-8C9D-0E1F2A3B4C5D')).toBeNull();
  });
  it('returns null for empty / nullish', () => {
    expect(counterpartyLabel(null)).toBeNull();
    expect(counterpartyLabel(undefined)).toBeNull();
    expect(counterpartyLabel('   ')).toBeNull();
  });
  it('keeps a real human/business name, trimmed', () => {
    expect(counterpartyLabel('Ramesh Traders')).toBe('Ramesh Traders');
    expect(counterpartyLabel('  Green Agro  ')).toBe('Green Agro');
  });
});

describe('buyerOrderTab / counts (screen 69)', () => {
  it('buckets statuses into active/delivered/returns', () => {
    expect(buyerOrderTab('in_transit')).toBe('active');
    expect(buyerOrderTab('confirmed')).toBe('active');
    expect(buyerOrderTab('delivered')).toBe('delivered');
    expect(buyerOrderTab('completed')).toBe('delivered');
    expect(buyerOrderTab('refunded')).toBe('returns');
    expect(buyerOrderTab('cancelled')).toBe('returns');
    expect(buyerOrderTab('whatever')).toBe('active');
  });
  it('matchesBuyerTab + counts from loaded orders', () => {
    const rows = [{ status: 'in_transit' }, { status: 'confirmed' }, { status: 'delivered' }, { status: 'completed' }, { status: 'refunded' }];
    expect(matchesBuyerTab('delivered', 'delivered')).toBe(true);
    expect(matchesBuyerTab('delivered', 'active')).toBe(false);
    expect(buyerOrderCounts(rows)).toEqual({ active: 2, delivered: 2, returns: 1 });
  });
});

describe('matchesOrderFilter', () => {
  it('all passes everything; groups map status sets', () => {
    expect(matchesOrderFilter('completed', 'all')).toBe(true);
    expect(matchesOrderFilter('in_transit', 'in_transit')).toBe(true);
    expect(matchesOrderFilter('packed', 'in_transit')).toBe(true);
    expect(matchesOrderFilter('delivered', 'delivered')).toBe(true);
    expect(matchesOrderFilter('completed', 'completed')).toBe(true);
    expect(matchesOrderFilter('refunded', 'cancelled')).toBe(true);
    expect(matchesOrderFilter('completed', 'in_transit')).toBe(false);
  });
});

describe('orderProgress', () => {
  it('rises monotonically along the lifecycle; cancelled → 0', () => {
    expect(orderProgress('payment_pending')).toBe(10);
    expect(orderProgress('confirmed')).toBe(30);
    expect(orderProgress('out_for_delivery')).toBe(90);
    expect(orderProgress('completed')).toBe(100);
    expect(orderProgress('cancelled')).toBe(0);
    expect(orderProgress('???')).toBe(0);
  });
});

describe('orderListCta', () => {
  it('pay only for buyer on an unpaid order', () => {
    expect(orderListCta('payment_pending', 'buyer')).toBe('pay');
    expect(orderListCta('payment_pending', 'seller')).toBeNull();
  });
  it('track in-transit/delivered, rate when completed, else null', () => {
    expect(orderListCta('in_transit', 'seller')).toBe('track');
    expect(orderListCta('delivered', 'buyer')).toBe('track');
    expect(orderListCta('completed', 'seller')).toBe('rate');
    expect(orderListCta('confirmed', 'seller')).toBeNull();
  });
});

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

describe('orderTimeline', () => {
  it('always returns the 7 lifecycle steps', () => {
    expect(orderTimeline('confirmed')).toHaveLength(ORDER_TIMELINE_STEPS.length);
  });
  it('frontier is active, earlier steps done, later pending (in_transit → out_for_delivery active)', () => {
    const steps = orderTimeline('in_transit');
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.state]));
    expect(byKey.placed).toBe('done');
    expect(byKey.seller).toBe('done');
    expect(byKey.out_for_delivery).toBe('active');
    expect(byKey.delivered).toBe('pending');
  });
  it('completed marks every step done (terminal frontier is done not active)', () => {
    expect(orderTimeline('completed').every((s) => s.state === 'done')).toBe(true);
  });
  it('cancelled degrades to placed-done, rest pending', () => {
    const steps = orderTimeline('cancelled');
    expect(steps[0].state).toBe('done');
    expect(steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });
  it('attaches only real timestamps; invents none', () => {
    const steps = orderTimeline('delivered', { placed: '2026-08-15T09:00:00Z', delivered: '2026-08-15T16:00:00Z' });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.atIso]));
    expect(byKey.placed).toBe('2026-08-15T09:00:00Z');
    expect(byKey.delivered).toBe('2026-08-15T16:00:00Z');
    expect(byKey.payment).toBeNull();   // §13: no transition-log time → not fabricated
    expect(byKey.seller).toBeNull();
  });
});

describe('sellerOrderTab / matchesSellerTab', () => {
  it('routes statuses to New / Active / Completed', () => {
    expect(sellerOrderTab('created')).toBe('new');
    expect(sellerOrderTab('payment_pending')).toBe('new');
    expect(sellerOrderTab('confirmed')).toBe('active');
    expect(sellerOrderTab('in_transit')).toBe('active');
    expect(sellerOrderTab('completed')).toBe('completed');
    expect(sellerOrderTab('cancelled')).toBe('completed');
    expect(matchesSellerTab('packed', 'active')).toBe(true);
    expect(matchesSellerTab('packed', 'new')).toBe(false);
  });
});

describe('sellerOrderStats', () => {
  const nowMs = Date.UTC(2026, 5, 30); // June 2026
  it('counts New/Active and sums this-month gross as BigInt minor (real, never faked)', () => {
    const s = sellerOrderStats([
      { status: 'created', totalMinor: '864000', createdAt: '2026-06-10T00:00:00Z' },
      { status: 'confirmed', totalMinor: '955000', createdAt: '2026-06-12T00:00:00Z' },
      { status: 'completed', totalMinor: '1528000', createdAt: '2026-05-01T00:00:00Z' }, // last month → excluded from month sum
    ], nowMs);
    expect(s.newCount).toBe(1);
    expect(s.activeCount).toBe(1);
    expect(s.monthMinor).toBe('1819000'); // 864000 + 955000
  });
  it('degrades on a malformed amount without crashing', () => {
    const s = sellerOrderStats([{ status: 'created', totalMinor: 'oops', createdAt: '2026-06-10T00:00:00Z' }], nowMs);
    expect(s.monthMinor).toBe('0');
    expect(s.newCount).toBe(1);
  });
});

describe('sellerNetMinor', () => {
  it('subtotal minus commission as BigInt minor (matches design 8640−130=8510)', () => {
    expect(sellerNetMinor('864000', '13000')).toBe('851000');
  });
  it('floors at 0 and degrades on malformed input', () => {
    expect(sellerNetMinor('1000', '5000')).toBe('0');
    expect(sellerNetMinor('oops', '0')).toBe('0');
  });
});

describe('decisionMinutesLeft', () => {
  const now = Date.UTC(2026, 7, 15, 12, 0, 0);
  it('returns minutes remaining to a future deadline', () => {
    expect(decisionMinutesLeft('2026-08-15T16:00:00Z', now)).toBe(240);
  });
  it('negative when expired; null when absent/unparseable', () => {
    expect(decisionMinutesLeft('2026-08-15T11:00:00Z', now)).toBe(-60);
    expect(decisionMinutesLeft(null, now)).toBeNull();
    expect(decisionMinutesLeft('nope', now)).toBeNull();
  });
});

describe('orderBannerKey', () => {
  it('maps status groups to the design banner messages', () => {
    expect(orderBannerKey('payment_pending')).toBe('placed');
    expect(orderBannerKey('confirmed')).toBe('preparing');
    expect(orderBannerKey('in_transit')).toBe('on_the_way');
    expect(orderBannerKey('delivered')).toBe('delivered');
    expect(orderBannerKey('completed')).toBe('completed');
    expect(orderBannerKey('cancelled')).toBe('cancelled');
    expect(orderBannerKey('???')).toBe('placed');
  });
});
