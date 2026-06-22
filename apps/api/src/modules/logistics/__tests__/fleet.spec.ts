// modules/logistics/__tests__/fleet.spec.ts · pure-domain unit tests for the fleet registry (API-W3-03):
// LogisticsPartner, Vehicle (reg-no normalisation), PickupSlot (weekday/window invariants). The service-level
// UoW/outbox/audit/idempotency/tenant-isolation is covered by fleet.integration.spec.ts.
import { LogisticsPartner, PARTNER_KINDS } from '../domain/logistics-partner.entity';
import { Vehicle, normalizeRegNo } from '../domain/vehicle.entity';
import { PickupSlot } from '../domain/pickup-slot.entity';
import { InvalidPartnerError, InvalidVehicleError, InvalidPickupSlotError, FleetAlreadyInStateError } from '../domain/logistics.errors';
import { FleetEventType } from '../domain/logistics.events';

describe('LogisticsPartner', () => {
  const base = { id: 'p1', tenantId: 't1', providerCode: null, defaultName: 'Speedy 3PL', riderUserId: null, supportsColdChain: false };

  it('creates a 3pl partner and emits partner_registered', () => {
    const p = LogisticsPartner.create({ ...base, partnerKind: '3pl' });
    expect(p.isActive).toBe(true);
    expect(p.pullEvents().map((e) => e.type)).toContain(FleetEventType.PartnerRegistered);
  });
  it('a rider partner requires a rider_user_id', () => {
    expect(() => LogisticsPartner.create({ ...base, partnerKind: 'rider', riderUserId: null })).toThrow(InvalidPartnerError);
    expect(() => LogisticsPartner.create({ ...base, partnerKind: 'rider', riderUserId: 'u9' })).not.toThrow();
  });
  it('rejects an unknown partner_kind', () => {
    expect(() => LogisticsPartner.create({ ...base, partnerKind: 'drone' as any })).toThrow(InvalidPartnerError);
  });
  it('rejects names with markup / control chars', () => {
    expect(() => LogisticsPartner.create({ ...base, partnerKind: '3pl', defaultName: '<script>x' })).toThrow(InvalidPartnerError);
    expect(() => LogisticsPartner.create({ ...base, partnerKind: '3pl', defaultName: '   ' })).toThrow(InvalidPartnerError);
  });
  it('setActive is idempotent-guarded (no-op throws)', () => {
    const p = LogisticsPartner.create({ ...base, partnerKind: '3pl' }); p.pullEvents();
    expect(() => p.setActive(true)).toThrow(FleetAlreadyInStateError);
    expect(p.setActive(false).action).toBe('deactivated');
  });
  it('update with no real change throws (already in state)', () => {
    const p = LogisticsPartner.create({ ...base, partnerKind: '3pl' });
    expect(() => p.update({ defaultName: 'Speedy 3PL' })).toThrow(FleetAlreadyInStateError);
    expect(p.update({ defaultName: 'Speedy Logistics' }).new).toEqual({ defaultName: 'Speedy Logistics' });
  });
  it('exposes the documented partner kinds', () => { expect(PARTNER_KINDS).toEqual(['3pl', 'tenant_fleet', 'rider']); });
});

describe('Vehicle', () => {
  const base = { id: 'v1', tenantId: 't1', partnerId: 'p1', vehicleTypeId: null, capacityKg: null, isRefrigerated: false, rcDocId: null };

  it('normalises the registration number (upper, strip spaces/dots)', () => {
    expect(normalizeRegNo(' mh12 ab.1234 ')).toBe('MH12AB1234');
  });
  it('rejects an out-of-range reg_no', () => {
    expect(() => normalizeRegNo('!!')).toThrow(InvalidVehicleError);
  });
  it('creates a vehicle and emits vehicle_registered', () => {
    const v = Vehicle.create({ ...base, regNo: 'mh12ab1234' });
    expect(v.toProps().regNo).toBe('MH12AB1234');
    expect(v.pullEvents().map((e) => e.type)).toContain(FleetEventType.VehicleRegistered);
  });
  it('rejects a non-positive / oversized capacity', () => {
    expect(() => Vehicle.create({ ...base, regNo: 'KA01AA1', capacityKg: 0 })).toThrow(InvalidVehicleError);
    expect(() => Vehicle.create({ ...base, regNo: 'KA01AA1', capacityKg: 1_000_000 })).toThrow(InvalidVehicleError);
    expect(() => Vehicle.create({ ...base, regNo: 'KA01AA1', capacityKg: 1500 })).not.toThrow();
  });
});

describe('PickupSlot', () => {
  const base = { id: 'sl1', tenantId: 't1', sellerUserId: 'u1' };

  it('creates a slot and emits pickup_slot_created', () => {
    const s = PickupSlot.create({ ...base, weekday: 2, startTime: '09:00', endTime: '12:00' });
    expect(s.isActive).toBe(true);
    expect(s.pullEvents().map((e) => e.type)).toContain(FleetEventType.PickupSlotCreated);
  });
  it('rejects an out-of-range weekday', () => {
    expect(() => PickupSlot.create({ ...base, weekday: 7, startTime: '09:00', endTime: '12:00' })).toThrow(InvalidPickupSlotError);
  });
  it('rejects start >= end', () => {
    expect(() => PickupSlot.create({ ...base, weekday: 1, startTime: '12:00', endTime: '12:00' })).toThrow(InvalidPickupSlotError);
    expect(() => PickupSlot.create({ ...base, weekday: 1, startTime: '13:00', endTime: '09:00' })).toThrow(InvalidPickupSlotError);
  });
  it('rejects malformed times', () => {
    expect(() => PickupSlot.create({ ...base, weekday: 1, startTime: '9am', endTime: '12:00' })).toThrow(InvalidPickupSlotError);
    expect(() => PickupSlot.create({ ...base, weekday: 1, startTime: '25:00', endTime: '26:00' })).toThrow(InvalidPickupSlotError);
  });
  it('update validates the resulting window', () => {
    const s = PickupSlot.create({ ...base, weekday: 1, startTime: '09:00', endTime: '12:00' }); s.pullEvents();
    expect(() => s.update({ startTime: '13:00' })).toThrow(InvalidPickupSlotError); // 13:00 >= 12:00
    expect(s.update({ endTime: '15:00' }).new).toEqual({ endTime: '15:00' });
  });
});
