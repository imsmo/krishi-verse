// apps/web-tenant/src/test/orders-lifecycle.spec.ts · unit tests for the seller order lifecycle gating. The
// console must only surface LEGAL transitions (it mirrors the API state machine); these pin that the right verbs
// appear per status and that terminal/illegal moves never do.
import { canTransition, isCancellable, sellerActions, isSellerAction } from '../features/orders/lifecycle';

describe('canTransition', () => {
  it('allows the documented seller path', () => {
    expect(canTransition('created', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'packed')).toBe(true);
    expect(canTransition('packed', 'ready')).toBe(true);
    expect(canTransition('delivered', 'completed')).toBe(true);
  });
  it('forbids illegal / terminal moves', () => {
    expect(canTransition('ready', 'completed')).toBe(false); // delivery happens first (rider/shipment)
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('refunded', 'completed')).toBe(false);
    expect(canTransition('weird', 'confirmed')).toBe(false);
  });
});

describe('isCancellable', () => {
  it('is true pre-handoff, false after', () => {
    for (const s of ['created', 'payment_pending', 'confirmed', 'packed', 'ready']) expect(isCancellable(s)).toBe(true);
    for (const s of ['delivered', 'completed', 'cancelled', 'refunded']) expect(isCancellable(s)).toBe(false);
  });
});

describe('sellerActions', () => {
  it('confirmed → packed + cancel', () => expect(sellerActions('confirmed')).toEqual(['packed', 'cancel']));
  it('created → confirm + cancel', () => expect(sellerActions('created')).toEqual(['confirm', 'cancel']));
  it('packed → ready + cancel', () => expect(sellerActions('packed')).toEqual(['ready', 'cancel']));
  it('out_for_delivery → delivered only', () => expect(sellerActions('out_for_delivery')).toEqual(['delivered']));
  it('delivered → complete only', () => expect(sellerActions('delivered')).toEqual(['complete']));
  it('completed / cancelled → nothing', () => {
    expect(sellerActions('completed')).toEqual([]);
    expect(sellerActions('cancelled')).toEqual([]);
  });
});

describe('isSellerAction', () => {
  it('guards the action allowlist', () => {
    expect(isSellerAction('confirm')).toBe(true);
    expect(isSellerAction('cancel')).toBe(true);
    expect(isSellerAction('refund')).toBe(false);
    expect(isSellerAction('')).toBe(false);
  });
});
