// modules/equipment/__tests__/equipment-asset.service.spec.ts · AssetService unit tests with fakes.
// Pins: register drains the asset_listed event to the outbox in-tx (Law 4) + enforces quota; update/status
// forbid acting on another owner's asset (authz THROWS, Law 6); a duplicate reg_no maps to a typed 409.
import { EquipmentAssetService } from '../services/equipment-asset.service';
import { EquipmentAsset } from '../domain/equipment-asset.entity';
import { EquipmentForbiddenError, RegNoExistsError } from '../domain/equipment.errors';

function harness(existing: EquipmentAsset | null, insertThrows?: any) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = {
    insert: jest.fn(async () => { if (insertThrows) throw insertThrows; }),
    getForUpdate: jest.fn(async () => existing), update: jest.fn(), getById: jest.fn(), listFor: jest.fn(),
  };
  const svc = new EquipmentAssetService(uow as any, outbox as any, idem as any, quota as any, metrics as any, repo as any);
  return { svc, outbox, quota, repo };
}
const owner = { userId: 'owner1', canManage: true, canRent: false, isAdmin: false };

describe('EquipmentAssetService.register', () => {
  it('lists an asset (quota-checked) + drains asset_listed to the outbox', async () => {
    const { svc, outbox, quota } = harness(null);
    const out = await svc.register('t1', owner, 'idem-1', { categoryId: 'c1' } as any);
    expect(quota.assertWithinLimit).toHaveBeenCalledWith('t1', 'equipment_assets');
    expect(out.ownerUserId).toBe('owner1'); expect(out.status).toBe('active');
    expect(outbox.write.mock.calls[0][1].eventType).toBe('equipment.asset_listed');
  });
  it('maps a duplicate reg_no (23505) to a typed 409', async () => {
    const { svc } = harness(null, { code: '23505' });
    await expect(svc.register('t1', owner, 'idem-2', { categoryId: 'c1', regNo: 'GJ01AB1234' } as any)).rejects.toBeInstanceOf(RegNoExistsError);
  });
  it('requires equipment.manage', async () => {
    const { svc } = harness(null);
    await expect(svc.register('t1', { ...owner, canManage: false }, 'idem-3', { categoryId: 'c1' } as any)).rejects.toBeInstanceOf(EquipmentForbiddenError);
  });
});

describe('EquipmentAssetService.update authz', () => {
  it('forbids editing another owner\'s asset', async () => {
    const other = EquipmentAsset.rehydrate({ id: 'a1', tenantId: 't1', ownerUserId: 'someone_else', categoryId: 'c1', productId: null, regNo: null, yearOfMfg: null, engineHours: null, hpRating: null, baseAddressId: null, serviceRadiusKm: 25, gpsDeviceRef: null, status: 'active' });
    const { svc } = harness(other);
    await expect(svc.update('t1', owner, 'a1', { serviceRadiusKm: 50 } as any)).rejects.toBeInstanceOf(EquipmentForbiddenError);
  });
});
