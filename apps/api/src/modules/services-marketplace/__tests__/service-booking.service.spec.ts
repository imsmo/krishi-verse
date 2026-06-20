// modules/services-marketplace/__tests__/service-booking.service.spec.ts · ServiceBookingService unit tests with fakes.
// Pins: the fee is SNAPSHOTTED from the offering price at request (never client-supplied); cannot book your own
// offering; cannot book an unpublished offering; reads 404 (not IDOR) for non-parties; and completeAndPay posts
// a ZERO-SUM customer→provider transfer (txnType service_fee) in-tx (Law 2). Real SQL/RLS = integration.
import { ServiceBookingService } from '../services/service-booking.service';
import { ServiceOffering } from '../domain/service-offering.entity';
import { ServiceBooking } from '../domain/service-booking.entity';
import { OfferingNotBookableError, BookingNotFoundError, InvalidBookingError } from '../domain/services-marketplace.errors';

const offering = (over: Partial<any> = {}) => ServiceOffering.rehydrate({ id: 'o1', tenantId: 't1', providerUserId: 'prov', categoryId: 'c1', defaultTitle: 'Ploughing',
  description: null, pricingModel: 'per_person', priceMinor: 10000n, currencyCode: 'INR', capacityPerSlot: null, serviceRadiusKm: 20, addressId: null, status: 'published', ...over });

function harness(opts: { offering?: ServiceOffering | null; booking?: ServiceBooking } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 'tx1', alreadyApplied: false })), balanceMinor: jest.fn() };
  const bookings = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.booking ?? null), update: jest.fn(), getById: jest.fn(async () => opts.booking ?? null), listFor: jest.fn() };
  const offerings = { getById: jest.fn(async () => (opts.offering === undefined ? offering() : opts.offering)) };
  const s = new ServiceBookingService(uow as any, outbox as any, idem as any, metrics as any, wallet as any, bookings as any, offerings as any);
  return { s, wallet, bookings, outbox };
}
const customer = { userId: 'cust', canOffer: false, canBook: true, isAdmin: false };

describe('ServiceBookingService.request', () => {
  it('snapshots total from the offering price × guests (per_person, not client)', async () => {
    const { s, bookings } = harness();
    const out = await s.request('t1', customer, 'idem-1', { offeringId: 'o1', startsAt: new Date().toISOString(), guests: 3 } as any);
    expect(out.totalMinor).toBe('30000');           // 10000 * 3
    expect(out.providerUserId).toBe('prov');
    expect(bookings.insert).toHaveBeenCalledTimes(1);
  });
  it('rejects booking an unpublished offering', async () => {
    const { s } = harness({ offering: offering({ status: 'paused' }) });
    await expect(s.request('t1', customer, 'idem-2', { offeringId: 'o1', startsAt: new Date().toISOString(), guests: 1 } as any)).rejects.toBeInstanceOf(OfferingNotBookableError);
  });
  it('forbids booking your own offering', async () => {
    const provActor = { userId: 'prov', canOffer: true, canBook: true, isAdmin: false };
    const { s } = harness();
    await expect(s.request('t1', provActor, 'idem-3', { offeringId: 'o1', startsAt: new Date().toISOString(), guests: 1 } as any)).rejects.toBeInstanceOf(InvalidBookingError);
  });
});

describe('ServiceBookingService.completeAndPay — the money path', () => {
  const inProgress = () => ServiceBooking.rehydrate({ id: 'b1', tenantId: 't1', offeringId: 'o1', providerUserId: 'prov', customerUserId: 'cust', bookingNo: 'SB-1',
    startsAt: new Date(), endsAt: null, guests: 3, totalMinor: 30000n, status: 'in_progress', notes: null });
  it('posts a ZERO-SUM customer→provider service_fee transfer in-tx, then completes', async () => {
    const { s, wallet, bookings } = harness({ booking: inProgress() });
    const out = await s.completeAndPay('t1', customer, 'b1', 'idem-pay');
    expect(out.status).toBe('completed'); expect(out.feePaidMinor).toBe('30000');
    expect(wallet.post).toHaveBeenCalledTimes(1);
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('service_fee'); expect(arg.idempotencyKey).toBe('svcbook:b1');
    const sum = arg.legs.reduce((acc: bigint, l: any) => acc + l.amountMinor, 0n);
    expect(sum).toBe(0n);                                                                  // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor < 0n).account.userId).toBe('cust');     // customer debited
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).account.userId).toBe('prov');     // provider credited
    expect(bookings.update).toHaveBeenCalledTimes(1);
  });
  it('moves no money if the booking is not in_progress', async () => {
    const confirmed = ServiceBooking.rehydrate({ id: 'b1', tenantId: 't1', offeringId: 'o1', providerUserId: 'prov', customerUserId: 'cust', bookingNo: 'SB-1',
      startsAt: new Date(), endsAt: null, guests: 3, totalMinor: 30000n, status: 'confirmed', notes: null });
    const { s, wallet } = harness({ booking: confirmed });
    await expect(s.completeAndPay('t1', customer, 'b1', 'idem-pay')).rejects.toThrow();
    expect(wallet.post).not.toHaveBeenCalled();
  });
  it('a stranger gets 404 (no cross-party IDOR) on getById', async () => {
    const { s } = harness({ booking: inProgress() });
    const stranger = { userId: 'someoneElse', canOffer: false, canBook: true, isAdmin: false };
    await expect(s.getById('t1', stranger, 'b1')).rejects.toBeInstanceOf(BookingNotFoundError);
  });
});
