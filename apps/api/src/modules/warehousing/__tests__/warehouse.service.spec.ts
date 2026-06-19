// modules/warehousing/__tests__/warehouse.service.spec.ts · WarehouseService unit tests (fakes).
// Pins: register quota-checks + drains warehouse_listed to the outbox + audits; update is operator-only (authz THROWS).
import { WarehouseService } from '../services/warehouse.service';
import { Warehouse } from '../domain/warehouse.entity';
import { WarehousingForbiddenError } from '../domain/warehousing.errors';

function harness(existing: Warehouse | null) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() }; const metrics = { inc: jest.fn(), observe: jest.fn() }; const audit = { write: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => existing), update: jest.fn(), getBookable: jest.fn(), listFor: jest.fn() };
  const svc = new WarehouseService(uow as any, outbox as any, idem as any, quota as any, metrics as any, audit as any, repo as any);
  return { svc, outbox, quota, audit };
}
const op = { userId: 'op1', canManage: true, canStore: false, isAdmin: false };

describe('WarehouseService.register', () => {
  it('quota-checks, persists, audits + emits warehouse_listed', async () => {
    const { svc, outbox, quota, audit } = harness(null);
    const out = await svc.register('t1', op, 'idem-1', { defaultName: 'Anand WH', storageKinds: [], commoditiesAccepted: [], ratePerQtlMonthMinor: '5000' } as any, '1.2.3.4');
    expect(quota.assertWithinLimit).toHaveBeenCalledWith('t1', 'warehouses');
    expect(out.defaultName).toBe('Anand WH'); expect(out.ratePerQtlMonthMinor).toBe('5000');
    expect(outbox.write.mock.calls[0][1].eventType).toBe('warehousing.warehouse_listed');
    expect(audit.write).toHaveBeenCalledTimes(1);
  });
  it('requires warehouse.manage', async () => {
    const { svc } = harness(null);
    await expect(svc.register('t1', { ...op, canManage: false }, 'idem-2', { defaultName: 'X', storageKinds: [], commoditiesAccepted: [] } as any, null)).rejects.toBeInstanceOf(WarehousingForbiddenError);
  });
});

describe('WarehouseService.update authz', () => {
  it('forbids editing another operator\'s warehouse', async () => {
    const other = Warehouse.rehydrate({ id: 'w1', tenantId: 't1', operatorUserId: 'someone', defaultName: 'W', wdraRegNo: null, addressId: null, capacityMt: null, storageKinds: [], commoditiesAccepted: [], ratePerQtlMonthMinor: null, insurancePolicyRef: null, isActive: true });
    const { svc } = harness(other);
    await expect(svc.update('t1', op, 'w1', { defaultName: 'New' } as any)).rejects.toBeInstanceOf(WarehousingForbiddenError);
  });
});
