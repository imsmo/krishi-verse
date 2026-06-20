// modules/services-marketplace/__tests__/services-marketplace-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: offering price must be > 0; per_person pricing multiplies by guests (float-free, exact bigint); the
// offering + booking state machines (legal/illegal transitions); and completable only from in_progress.
import { ServiceOffering } from '../domain/service-offering.entity';
import { ServiceBooking } from '../domain/service-booking.entity';
import { InvalidOfferingError, BookingNotCompletableError } from '../domain/services-marketplace.errors';

const baseOffering = (over: Partial<any> = {}) => ServiceOffering.create({ id: 'o1', tenantId: 't1', providerUserId: 'prov', categoryId: 'c1', defaultTitle: 'Tractor ploughing',
  description: null, pricingModel: 'per_visit', priceMinor: 50000n, currencyCode: 'INR', capacityPerSlot: null, serviceRadiusKm: 20, addressId: null, ...over });

describe('ServiceOffering', () => {
  it('rejects a non-positive price', () => {
    expect(() => baseOffering({ priceMinor: 0n })).toThrow(InvalidOfferingError);
    expect(() => baseOffering({ priceMinor: -1n })).toThrow(InvalidOfferingError);
  });
  it('per_person pricing multiplies by guests exactly (bigint, no float drift)', () => {
    const o = baseOffering({ pricingModel: 'per_person', priceMinor: 12345n });
    expect(o.totalFor(7)).toBe(86415n);   // 12345 * 7
  });
  it('non-per_person pricing ignores guests', () => {
    expect(baseOffering({ pricingModel: 'per_visit', priceMinor: 50000n }).totalFor(5)).toBe(50000n);
  });
  it('lifecycle: draft→publish→pause→publish→archive; cannot edit when archived', () => {
    const o = baseOffering();
    o.publish(); expect(o.status).toBe('published');
    o.pause();   expect(o.status).toBe('paused');
    o.publish(); expect(o.status).toBe('published');
    o.archive(); expect(o.status).toBe('archived');
    expect(() => o.update({ defaultTitle: 'x' })).toThrow(InvalidOfferingError);
  });
});

describe('ServiceBooking state machine', () => {
  const mk = (status: any) => ServiceBooking.rehydrate({ id: 'b1', tenantId: 't1', offeringId: 'o1', providerUserId: 'prov', customerUserId: 'cust', bookingNo: 'SB-1',
    startsAt: new Date(), endsAt: null, guests: 1, totalMinor: 50000n, status, notes: null });
  it('happy path requested→confirmed→in_progress→completed', () => {
    const b = mk('requested'); b.confirm(); b.start(); b.complete(); expect(b.status).toBe('completed');
  });
  it('complete() throws unless in_progress', () => {
    expect(() => mk('confirmed').complete()).toThrow(BookingNotCompletableError);
    expect(() => mk('requested').complete()).toThrow(BookingNotCompletableError);
  });
  it('can cancel from requested or confirmed', () => {
    const a = mk('requested'); a.cancel('changed mind'); expect(a.status).toBe('cancelled');
    const c = mk('confirmed'); c.cancel(); expect(c.status).toBe('cancelled');
  });
  it('cannot confirm a completed booking', () => {
    const b = mk('requested'); b.confirm(); b.start(); b.complete();
    expect(() => b.confirm()).toThrow();
  });
});
