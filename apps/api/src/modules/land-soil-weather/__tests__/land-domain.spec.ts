// modules/land-soil-weather/__tests__/land-domain.spec.ts · pure-domain unit tests: the crop-season state
// machine + the parcel/crop/soil aggregates (area/yield are float-free scaled integers). No infra.
import { canTransition, isTerminal, CROP_STATUSES, CropStatus, IllegalCropTransitionError } from '../domain/crop-season.state';
import { LandParcel } from '../domain/land-parcel.entity';
import { CropSeason } from '../domain/crop-season.entity';
import { SoilTest } from '../domain/soil-test.entity';
import { LandEventType } from '../domain/land-soil-weather.events';
import { InvalidParcelError, InvalidCropSeasonError, InvalidSoilTestError, LandForbiddenError } from '../domain/land-soil-weather.errors';

const parcel = (over: any = {}) => LandParcel.register({ id: 'p1', tenantId: 't1', ownerUserId: 'u1', regionId: null, surveyNo: '123/4', bhulekhRef: null,
  areaTenThousandth: 25000n, areaUnit: 'acre', irrigationTypeId: null, boundaryGeojson: null, isTenantFarmed: false, ...over });
const crop = (over: any = {}) => CropSeason.plan({ id: 'c1', tenantId: 't1', parcelId: 'p1', productId: 'prod1', season: 'kharif', year: 2026, expectedHarvest: null, expectedYieldMilli: null, ...over });

describe('crop-season.state machine', () => {
  it('planned→sown→harvested; abandon from planned/sown', () => {
    expect(canTransition('planned', 'sown')).toBe(true);
    expect(canTransition('sown', 'harvested')).toBe(true);
    expect(canTransition('planned', 'abandoned')).toBe(true);
    expect(canTransition('sown', 'abandoned')).toBe(true);
    expect(canTransition('planned', 'harvested')).toBe(false);
    expect(canTransition('harvested', 'sown')).toBe(false);
    expect(isTerminal('harvested')).toBe(true); expect(isTerminal('abandoned')).toBe(true);
    for (const s of CROP_STATUSES) expect(() => canTransition(s, 'abandoned' as CropStatus)).not.toThrow();
    expect(new IllegalCropTransitionError('harvested', 'planned').code).toBe('CROP_SEASON_ILLEGAL_TRANSITION');
  });
});

describe('LandParcel', () => {
  it('registers active with area as a scaled integer (2.5000 acre)', () => {
    const p = parcel(); expect(p.toJSON().area).toBe('2.5000'); expect(p.toJSON().verificationStatus).toBe('none');
    expect(p.pullEvents().map((e) => e.type)).toContain(LandEventType.ParcelRegistered);
  });
  it('rejects non-positive area; assertOwner throws for a stranger', () => {
    expect(() => parcel({ areaTenThousandth: 0n })).toThrow(InvalidParcelError);
    expect(() => parcel().assertOwner('someone_else', false)).toThrow(LandForbiddenError);
    expect(() => parcel().assertOwner('someone_else', true)).not.toThrow(); // admin override
  });
});

describe('CropSeason lifecycle', () => {
  it('plan→sow→harvest stamps dates/yield + emits events', () => {
    const c = crop(); c.pullEvents();
    c.sow('2026-06-15'); c.harvest(3500n);   // 3.500 (scaled ×1000)
    expect(c.status).toBe('harvested'); expect(c.toJSON().sownOn).toBe('2026-06-15'); expect(c.toJSON().actualYield).toBe('3.500');
    expect(c.pullEvents().map((e) => e.type)).toEqual([LandEventType.CropSeasonSown, LandEventType.CropSeasonHarvested]);
  });
  it('rejects a bad year and a negative yield', () => {
    expect(() => crop({ year: 1900 })).toThrow(InvalidCropSeasonError);
    const c = crop(); c.sow('2026-06-15');
    expect(() => c.harvest(-1n)).toThrow(InvalidCropSeasonError);
  });
});

describe('SoilTest', () => {
  it('requires sampled date + non-empty results; emits soil_test_recorded', () => {
    expect(() => SoilTest.record({ id: 's', tenantId: 't', parcelId: 'p1', labName: null, shcCardNo: null, sampledOn: '2026-05-01', results: {}, recommendations: {}, reportMediaId: null, validUntil: null })).toThrow(InvalidSoilTestError);
    const t = SoilTest.record({ id: 's', tenantId: 't', parcelId: 'p1', labName: 'SHC Lab', shcCardNo: 'SHC-1', sampledOn: '2026-05-01', results: { ph: 6.8, n: 280 }, recommendations: { urea_kg: 50 }, reportMediaId: null, validUntil: null });
    expect(t.pullEvents().map((e) => e.type)).toContain(LandEventType.SoilTestRecorded);
  });
});
