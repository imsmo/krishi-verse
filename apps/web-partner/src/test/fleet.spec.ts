// apps/web-partner/src/test/fleet.spec.ts · unit tests for the pure 3PL fleet helpers.
import {
  PARTNER_KINDS, isPartnerKind, partnerKindKey, weekdayKey, validName, parseProviderCode, normalizeRegNo,
  parseCapacityKg, validTime, parseWeekday, parseBool, parseActiveOnly,
  buildCreatePartner, buildUpdatePartner, buildCreateVehicle, buildUpdateVehicle, buildCreateSlot, buildSetActive,
  FleetError,
} from '../features/logistics/fleet';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('partner kinds + weekdays', () => {
  it('mirrors API kinds', () => {
    expect(PARTNER_KINDS).toEqual(['3pl', 'tenant_fleet', 'rider']);
    expect(isPartnerKind('rider')).toBe(true);
    expect(isPartnerKind('nope')).toBe(false);
    expect(partnerKindKey('3pl')).toBe('fleet.kind.3pl');
    expect(partnerKindKey('nope')).toBe('fleet.kind.unknown');
    expect(weekdayKey(0)).toBe('fleet.wd.0');
    expect(weekdayKey(9)).toBe('fleet.wd.unknown');
  });
});

describe('validators', () => {
  it('name + providerCode', () => {
    expect(validName(' Acme 3PL ')).toBe('Acme 3PL');
    expect(() => validName('')).toThrow(FleetError);
    expect(parseProviderCode('')).toBeNull();
    expect(parseProviderCode(' DELHIVERY ')).toBe('DELHIVERY');
    expect(() => parseProviderCode('x')).toThrow();
  });
  it('regNo normalises (trim/collapse/upper) + bounds', () => {
    expect(normalizeRegNo('  ka01  ab 1234 ')).toBe('KA01 AB 1234');
    expect(() => normalizeRegNo('ab')).toThrow();
  });
  it('capacityKg float-free, 1..100000, blank null', () => {
    expect(parseCapacityKg('')).toBeNull();
    expect(parseCapacityKg('1500')).toBe(1500);
    expect(() => parseCapacityKg('1.5')).toThrow();
    expect(() => parseCapacityKg('0')).toThrow();
    expect(() => parseCapacityKg('100001')).toThrow();
  });
  it('time + weekday + bools', () => {
    expect(validTime('09:30', 'k')).toBe('09:30');
    expect(() => validTime('24:00', 'k')).toThrow();
    expect(parseWeekday('6')).toBe(6);
    expect(() => parseWeekday('7')).toThrow();
    expect(parseBool('on')).toBe(true);
    expect(parseBool('false')).toBe(false);
    expect(parseActiveOnly(undefined)).toBe(true);
    expect(parseActiveOnly('false')).toBe(false);
  });
});

describe('builders', () => {
  it('create partner', () => {
    expect(buildCreatePartner({ partnerKind: '3pl', defaultName: 'Acme', providerCode: 'ACME', supportsColdChain: 'on' }))
      .toEqual({ partnerKind: '3pl', defaultName: 'Acme', providerCode: 'ACME', supportsColdChain: true });
    expect(() => buildCreatePartner({ partnerKind: 'bad', defaultName: 'Acme' })).toThrow();
  });
  it('update partner requires ≥1 field', () => {
    expect(() => buildUpdatePartner({})).toThrow(FleetError);
    expect(buildUpdatePartner({ defaultName: 'New' })).toEqual({ defaultName: 'New' });
    expect(buildUpdatePartner({ providerCode: '' })).toEqual({ providerCode: null });
  });
  it('create vehicle normalises reg + capacity', () => {
    expect(buildCreateVehicle({ partnerId: UUID, regNo: 'ka01ab1234', capacityKg: '2000', isRefrigerated: 'on' }))
      .toEqual({ partnerId: UUID, regNo: 'KA01AB1234', capacityKg: 2000, isRefrigerated: true });
    expect(() => buildCreateVehicle({ partnerId: 'nope', regNo: 'KA01AB1234' })).toThrow();
  });
  it('update vehicle ≥1', () => {
    expect(() => buildUpdateVehicle({})).toThrow();
    expect(buildUpdateVehicle({ capacityKg: '' })).toEqual({ capacityKg: null });
  });
  it('create slot enforces start<end', () => {
    expect(buildCreateSlot({ weekday: '1', startTime: '09:00', endTime: '17:00' })).toEqual({ weekday: 1, startTime: '09:00', endTime: '17:00' });
    expect(() => buildCreateSlot({ weekday: '1', startTime: '17:00', endTime: '09:00' })).toThrow();
    expect(() => buildCreateSlot({ weekday: '1', startTime: '09:00', endTime: '09:00' })).toThrow();
  });
  it('set active', () => {
    expect(buildSetActive(true)).toEqual({ isActive: true });
    expect(buildSetActive(false)).toEqual({ isActive: false });
  });
});
