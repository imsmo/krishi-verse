// modules/warehousing/__tests__/warehousing-domain.spec.ts · pure-domain unit tests: the storage-booking +
// NWR state machines, the FLOAT-FREE storage-fee computation, the months-stored rounding, and NWR/assay
// invariants. No infra — UoW/outbox/wallet are the integration + service specs.
import { canTransition as bCan, isStored, BOOKING_STATUSES, BookingStatus, IllegalBookingTransitionError } from '../domain/storage-booking.state';
import { canTransition as nCan, isActive, NWR_STATUSES, NwrStatus } from '../domain/nwr-receipt.state';
import { StorageBooking } from '../domain/storage-booking.entity';
import { NwrReceipt } from '../domain/nwr-receipt.entity';
import { AssayReport } from '../domain/assay-report.entity';
import { WarehousingEventType } from '../domain/warehousing.events';
import { InvalidBookingError, InvalidNwrError, InvalidAssayError } from '../domain/warehousing.errors';

const booking = (over: any = {}) => StorageBooking.request({ id: 'b1', tenantId: 't1', warehouseId: 'w1', depositorUserId: 'dep1', productId: 'p1',
  quantityMilli: 100000n, unitCode: 'quintal', expectedArrival: null, ...over });

describe('storage-booking.state machine', () => {
  it('requested→confirmed→stored→released; cancel from early; no resurrection', () => {
    expect(bCan('requested', 'confirmed')).toBe(true);
    expect(bCan('confirmed', 'stored')).toBe(true);
    expect(bCan('stored', 'released')).toBe(true);
    expect(bCan('requested', 'stored')).toBe(false);
    expect(bCan('stored', 'cancelled')).toBe(false);
    expect(isStored('stored')).toBe(true);
    for (const s of BOOKING_STATUSES) expect(() => bCan(s, 'cancelled' as BookingStatus)).not.toThrow();
    expect(new IllegalBookingTransitionError('released', 'stored').code).toBe('STORAGE_BOOKING_ILLEGAL_TRANSITION');
  });
});

describe('storage fee — float-free', () => {
  it('100 qtl × ₹50/qtl/month × 2 months = ₹10,000.00 EXACT', () => {
    // quantityMilli 100000, rate 5000 minor, months 2 → 100000×5000×2/1000 = 1,000,000
    expect(booking().storageFeeMinor(5000n, 2)).toBe(1_000_000n);
  });
  it('zero rate or zero months → no fee', () => {
    expect(booking().storageFeeMinor(0n, 3)).toBe(0n);
    expect(booking().storageFeeMinor(5000n, 0)).toBe(0n);
  });
  it('monthsStored is ceil(days/30), minimum 1, from stored_at', () => {
    const b = booking(); b.confirm(); b.store(new Date('2026-06-01T00:00:00Z'));
    expect(b.monthsStored(new Date('2026-06-10T00:00:00Z'))).toBe(1);     // <30d → 1
    expect(b.monthsStored(new Date('2026-07-05T00:00:00Z'))).toBe(2);     // 34d → 2
  });
  it('full lifecycle emits the right events incl. fee on release', () => {
    const b = booking(); b.pullEvents();
    b.confirm(); b.store(new Date()); b.release(new Date(), 1_000_000n);
    expect(b.status).toBe('released');
    expect(b.pullEvents().map((e) => e.type)).toEqual([WarehousingEventType.BookingConfirmed, WarehousingEventType.BookingStored, WarehousingEventType.BookingReleased]);
  });
  it('rejects non-positive quantity', () => { expect(() => booking({ quantityMilli: 0n })).toThrow(InvalidBookingError); });
});

describe('nwr-receipt.state + issuance invariants', () => {
  it('issued→released|cancelled; pledge/partial/default are NOT reachable (deferred)', () => {
    expect(nCan('issued', 'released')).toBe(true); expect(nCan('issued', 'cancelled')).toBe(true);
    expect(nCan('issued', 'pledged')).toBe(false); expect(nCan('pledged', 'released')).toBe(false);
    expect(isActive('issued')).toBe(true); expect(isActive('released')).toBe(false);
    for (const s of NWR_STATUSES) expect(() => nCan(s, 'cancelled' as NwrStatus)).not.toThrow();
  });
  it('issue requires positive quantity + valuation; valuation is bigint minor units', () => {
    const base = { id: 'n1', tenantId: 't1', storageBookingId: 'b1', repository: 'NERL' as const, enwrNo: 'E1', holderUserId: 'dep1', quantityMilli: 100000n, valuationMinor: 5_000_000n, issuedAt: new Date(), expiresAt: null };
    expect(() => NwrReceipt.issue({ ...base, valuationMinor: 0n })).toThrow(InvalidNwrError);
    const n = NwrReceipt.issue(base); expect(typeof n.toProps().valuationMinor).toBe('bigint'); expect(n.status).toBe('issued');
    n.pullEvents(); n.release(); expect(n.status).toBe('released');
  });
});

describe('AssayReport invariants', () => {
  it('requires assayer + parameters', () => {
    expect(() => AssayReport.record({ id: 'a', tenantId: 't', storageBookingId: 'b', assayerName: '', parameters: {}, gradeOptionId: null, reportMediaId: null, assayedAt: new Date(), validUntil: null })).toThrow(InvalidAssayError);
  });
});
