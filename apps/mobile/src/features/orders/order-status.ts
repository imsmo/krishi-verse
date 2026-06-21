// apps/mobile/src/features/orders/order-status.ts · PURE order/shipment status logic for the orders+delivery
// vertical (P-07). No React/native imports (ui type is `import type` → erased), so it's unit-tested under ts-jest.
// It mirrors the SERVER state machine (orders.domain/order.state + logistics shipment.state) for NAVIGATION ONLY:
// which actions a screen may OFFER for a given (status, role). The server re-validates every transition and
// ownership — the client never grants itself a transition; an illegal tap is rejected server-side (Law: untrusted
// client). `nextActions` is what drives the detail screen's action bar.
import type { PillTone } from '@krishi-verse/ui-native';

export type OrderRole = 'buyer' | 'seller';
export type OrderAction = 'confirm' | 'packed' | 'ready' | 'recordDelivery' | 'complete' | 'cancel' | 'review' | 'report' | 'track';

/** Status → chip tone. Unknown/intermediate statuses fall back to neutral (degrade-never-die). */
export function orderStatusTone(status: string): PillTone {
  switch (status) {
    case 'completed': case 'delivered': return 'success';
    case 'confirmed': case 'packed': case 'ready': return 'info';
    case 'picked_up': case 'in_transit': case 'out_for_delivery': return 'accent';
    case 'cancelled': case 'refunded': case 'partially_refunded': return 'danger';
    case 'disputed': return 'warning';
    default: return 'neutral'; // created / payment_pending / partially_fulfilled / unknown
  }
}

const IN_TRANSIT = new Set(['picked_up', 'in_transit', 'out_for_delivery']);

/** Which actions a screen may OFFER for (status, role). Order matters → drives button order. The SERVER is the
 * authority: it rejects any transition that isn't legal for this caller/state, so this is purely about UX. */
export function nextActions(status: string, role: OrderRole): OrderAction[] {
  if (role === 'seller') {
    switch (status) {
      case 'created': case 'payment_pending': return ['confirm', 'cancel', 'report'];
      case 'confirmed': return ['packed', 'cancel', 'report'];
      case 'packed': return ['ready', 'report'];
      case 'ready': return ['recordDelivery', 'report'];
      case 'delivered': return ['complete', 'track', 'report'];
      case 'completed': return ['review'];
      default: return IN_TRANSIT.has(status) ? ['track', 'report'] : [];
    }
  }
  // buyer
  switch (status) {
    case 'created': case 'payment_pending': case 'confirmed': return ['cancel', 'report'];
    case 'packed': case 'ready': return ['report'];
    case 'delivered': return ['complete', 'track', 'report'];
    case 'completed': return ['review'];
    default: return IN_TRANSIT.has(status) ? ['track', 'report'] : [];
  }
}

/** Proof-of-delivery OTP: exactly the server's contract (4–8 digits). Validated client-side for UX; the server
 * re-validates and is the authority on correctness (it hashes + compares). */
export function isValidPodOtp(otp: string): boolean {
  return /^\d{4,8}$/.test((otp ?? '').trim());
}

// --- shipment tracking (logistics) ---
/** The happy-path delivery sequence shown as a progress timeline. Terminal-negative states (failed/returned/
 * cancelled) are handled separately by the screen. */
export const TRACKING_SEQUENCE = ['pending', 'assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'delivered'] as const;
export type TrackingStep = { key: string; reached: boolean; current: boolean };

/** Map a shipment status to ordered steps with reached/current flags (pure, for the tracking timeline). An
 * unknown/negative status yields all-unreached so the UI degrades to "not started" rather than crashing. */
export function trackingSteps(shipmentStatus: string): TrackingStep[] {
  const idx = (TRACKING_SEQUENCE as readonly string[]).indexOf(shipmentStatus);
  return TRACKING_SEQUENCE.map((key, i) => ({ key, reached: idx >= 0 && i <= idx, current: i === idx }));
}
