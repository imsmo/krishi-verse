// modules/equipment/__tests__/equipment-domain.spec.ts · pure-domain unit tests: the rental state machine,
// the FLOAT-FREE total computation (rate × quantity), the advance/over-estimate bounds, and the OTP-gated
// start (constant-time compare). No infra — UoW/outbox/wallet are the integration + service specs.
import { canTransition, isTerminal, holdsEscrow, RENTAL_STATUSES, RentalStatus, IllegalRentalTransitionError } from '../domain/equipment-booking.state';
import { EquipmentBooking } from '../domain/equipment-booking.entity';
import { EquipmentRate } from '../domain/equipment-rate.entity';
import { EquipmentEventType } from '../domain/equipment.events';
import { InvalidBookingError, OverEstimateError, BookingStartOtpInvalidError, InvalidRateError } from '../domain/equipment.errors';

const make = (over: any = {}) => EquipmentBooking.request({ id: 'b1', tenantId: 't1', bookingNo: 'EQ-X', renterUserId: 'renter1', assetId: 'a1', ownerUserId: 'owner1',
  operatorUserId: null, taskDesc: null, rateBasis: 'per_hour', rateMinor: 50000n, estQuantityCenti: 400n, scheduledAt: new Date('2026-07-01T06:00:00Z'), ...over });

describe('rental.state machine', () => {
  it('requested→quoted→confirmed→in_progress→completed→settled; cancel from early states', () => {
    expect(canTransition('requested', 'quoted')).toBe(true);
    expect(canTransition('quoted', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
    expect(canTransition('completed', 'settled')).toBe(true);
    expect(canTransition('requested', 'confirmed')).toBe(false);
    expect(canTransition('in_progress', 'cancelled')).toBe(false);
    expect(holdsEscrow('confirmed')).toBe(true); expect(holdsEscrow('completed')).toBe(true); expect(holdsEscrow('requested')).toBe(false);
    expect(isTerminal('settled')).toBe(true); expect(isTerminal('cancelled')).toBe(true);
    for (const s of RENTAL_STATUSES) expect(() => canTransition(s, 'cancelled' as RentalStatus)).not.toThrow();
    expect(new IllegalRentalTransitionError('settled', 'requested').code).toBe('RENTAL_ILLEGAL_TRANSITION');
  });
});

describe('EquipmentRate', () => {
  it('rejects a non-positive rate; rate is bigint minor units', () => {
    expect(() => EquipmentRate.create({ id: 'r', assetId: 'a', rateBasis: 'per_hour', rateMinor: 0n, includesOperator: true, includesFuel: false, effectiveFrom: '2026-01-01', effectiveTo: null })).toThrow(InvalidRateError);
  });
});

describe('EquipmentBooking lifecycle + float-free totals', () => {
  it('estTotal = rate × est qty (₹500/hr × 4.00h = ₹2000), EXACT', () => {
    expect(make().estTotalMinor).toBe(200000n);
  });
  it('quote bounds the advance to ≤ estimated total', () => {
    const b = make(); expect(() => b.quote(200001n)).toThrow(InvalidBookingError);
    b.quote(80000n); expect(b.status).toBe('quoted'); expect(b.advanceMinor).toBe(80000n);
  });
  it('full happy path computes total from ACTUAL usage (₹500 × 3.50h = ₹1750)', () => {
    const b = make(); b.quote(80000n); b.confirm('HASH'); b.start('HASH', new Date()); b.pullEvents();
    b.complete(350n, new Date());
    expect(b.status).toBe('completed'); expect(b.totalMinor).toBe(175000n);
    b.markSettled(); expect(b.status).toBe('settled');
    expect(b.pullEvents().map((e) => e.type)).toEqual([EquipmentEventType.BookingCompleted, EquipmentEventType.BookingSettled]);
  });
  it('rejects actual usage beyond the agreed estimate (anti over-billing)', () => {
    const b = make(); b.quote(0n); b.confirm('H'); b.start('H', new Date());
    expect(() => b.complete(401n, new Date())).toThrow(OverEstimateError);
  });
  it('start is OTP-gated with a constant-time compare', () => {
    const b = make(); b.quote(0n); b.confirm('GOODHASH');
    expect(() => b.start('BADHASH0', new Date())).toThrow(BookingStartOtpInvalidError);
    b.start('GOODHASH', new Date()); expect(b.status).toBe('in_progress');
  });
  it('cannot settle before completion', () => {
    const b = make(); b.quote(0n); b.confirm('H'); b.start('H', new Date());
    expect(() => b.markSettled()).toThrow(InvalidBookingError);
  });
});
