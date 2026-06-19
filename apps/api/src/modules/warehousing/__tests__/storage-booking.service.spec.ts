// modules/warehousing/__tests__/storage-booking.service.spec.ts · StorageBookingService unit tests (fakes).
// Pins THE MONEY PATH: release() collects the storage fee depositor → operator (txnType storage_fee) as a
// ZERO-SUM idempotent post, only when a fee is due; a free (zero-rate) warehouse moves no money. Real SQL = integration.
import { StorageBookingService } from '../services/storage-booking.service';
import { StorageBooking } from '../domain/storage-booking.entity';
import { Warehouse } from '../domain/warehouse.entity';
import { NoWarehouseOperatorError } from '../domain/warehousing.errors';

const warehouse = (over: any = {}) => Warehouse.rehydrate({ id: 'w1', tenantId: 't1', operatorUserId: 'op1', defaultName: 'W', wdraRegNo: null, addressId: null, capacityMt: null, storageKinds: [], commoditiesAccepted: [], ratePerQtlMonthMinor: 5000n, insurancePolicyRef: null, isActive: true, ...over });
function storedBooking() {
  const b = StorageBooking.request({ id: 'b1', tenantId: 't1', warehouseId: 'w1', depositorUserId: 'dep1', productId: 'p1', quantityMilli: 100000n, unitCode: 'quintal', expectedArrival: null });
  b.confirm(); b.store(new Date(Date.now() - 40 * 86400000)); b.pullEvents(); // 40 days ago → 2 months
  return b;
}
function harness(wh: Warehouse) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() }; const audit = { write: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 't', alreadyApplied: false })), balanceMinor: jest.fn() };
  const repo = { getForUpdate: jest.fn(async () => storedBooking()), update: jest.fn() };
  const warehouses = { getBookable: jest.fn(async () => wh) };
  const svc = new StorageBookingService(uow as any, outbox as any, idem as any, metrics as any, audit as any, wallet as any, repo as any, warehouses as any);
  return { svc, wallet };
}
const op = { userId: 'op1', canManage: true, canStore: false, isAdmin: false };

describe('release — storage-fee settlement', () => {
  it('collects fee depositor → operator (zero-sum, storage_fee) for 100qtl×₹50×2mo = ₹10,000', async () => {
    const { svc, wallet } = harness(warehouse());
    const out = await svc.release('t1', op, 'b1', 'idem-r', null);
    expect(out.status).toBe('released'); expect(out.storageFeeMinor).toBe('1000000');
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('storage_fee'); expect(arg.idempotencyKey).toBe('storagefee:b1');
    expect(arg.legs.reduce((a: bigint, l: any) => a + l.amountMinor, 0n)).toBe(0n);   // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor < 0n).account.userId).toBe('dep1');  // depositor debited
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).account.userId).toBe('op1');   // operator credited
  });
  it('free (zero-rate) warehouse releases with NO money moved', async () => {
    const { svc, wallet } = harness(warehouse({ ratePerQtlMonthMinor: 0n }));
    const out = await svc.release('t1', op, 'b1', 'idem-r2', null);
    expect(out.storageFeeMinor).toBe('0'); expect(wallet.post).not.toHaveBeenCalled();
  });
  it('a fee-bearing warehouse with no operator fails closed (no payee)', async () => {
    const { svc, wallet } = harness(warehouse({ operatorUserId: null }));
    await expect(svc.release('t1', { ...op, isAdmin: true }, 'b1', 'idem-r3', null)).rejects.toBeInstanceOf(NoWarehouseOperatorError);
    expect(wallet.post).not.toHaveBeenCalled();
  });
});
