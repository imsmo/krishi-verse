// modules/land-soil-weather/__tests__/land-parcel.service.spec.ts · LandParcelService unit tests (fakes).
// Pins: register quota-checks + drains parcel_registered to the outbox in-tx (Law 4); update is owner-only (authz THROWS).
import { LandParcelService } from '../services/land-parcel.service';
import { LandParcel } from '../domain/land-parcel.entity';
import { LandForbiddenError } from '../domain/land-soil-weather.errors';

function harness(existing: LandParcel | null) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() }; const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => existing), update: jest.fn(), getById: jest.fn(), listFor: jest.fn(), resolveIrrigationTypeId: jest.fn(async () => 'i1') };
  const svc = new LandParcelService(uow as any, outbox as any, idem as any, quota as any, metrics as any, repo as any);
  return { svc, outbox, quota };
}
const farmer = { userId: 'u1', canManage: true, isAdmin: false };

describe('LandParcelService.register', () => {
  it('quota-checks + persists + emits parcel_registered', async () => {
    const { svc, outbox, quota } = harness(null);
    const out = await svc.register('t1', farmer, 'idem-1', { areaValue: '2.5000', areaUnit: 'acre', isTenantFarmed: false } as any);
    expect(quota.assertWithinLimit).toHaveBeenCalledWith('t1', 'land_parcels');
    expect(out.area).toBe('2.5000');
    expect(outbox.write.mock.calls[0][1].eventType).toBe('land.parcel_registered');
  });
  it('requires land.manage', async () => {
    const { svc } = harness(null);
    await expect(svc.register('t1', { ...farmer, canManage: false }, 'idem-2', { areaValue: '1', areaUnit: 'acre', isTenantFarmed: false } as any)).rejects.toBeInstanceOf(LandForbiddenError);
  });
});

describe('LandParcelService.update authz', () => {
  it('forbids editing another owner\'s parcel', async () => {
    const other = LandParcel.register({ id: 'p1', tenantId: 't1', ownerUserId: 'someone', regionId: null, surveyNo: null, bhulekhRef: null, areaTenThousandth: 10000n, areaUnit: 'acre', irrigationTypeId: null, boundaryGeojson: null, isTenantFarmed: false });
    const { svc } = harness(other);
    await expect(svc.update('t1', farmer, 'p1', { surveyNo: 'X' } as any)).rejects.toBeInstanceOf(LandForbiddenError);
  });
});
