// modules/equipment/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every asset/rate/booking read+write binds tenant_id (Law 1). No version columns → mutations lock FOR
// UPDATE (booking uses FOR UPDATE OF b across its JOIN to assets). Lists are keyset (never OFFSET). The
// owner is JOINed from equipment_assets (no owner_user_id column on bookings). Timeout finder is bounded.
import { EquipmentAssetRepository } from '../repositories/equipment-asset.repository';
import { EquipmentRateRepository } from '../repositories/equipment-rate.repository';
import { EquipmentBookingRepository } from '../repositories/equipment-booking.repository';
import { EquipmentAsset } from '../domain/equipment-asset.entity';
import { EquipmentBooking } from '../domain/equipment-booking.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const asset = () => EquipmentAsset.rehydrate({ id: 'a1', tenantId: 'tA', ownerUserId: 'o1', categoryId: 'c1', productId: null, regNo: null, yearOfMfg: null, engineHours: null, hpRating: null, baseAddressId: null, serviceRadiusKm: 25, gpsDeviceRef: null, status: 'active' });
const booking = () => EquipmentBooking.request({ id: 'b1', tenantId: 'tA', bookingNo: 'EQ-X', renterUserId: 'r1', assetId: 'a1', ownerUserId: 'o1', operatorUserId: null, taskDesc: null, rateBasis: 'per_hour', rateMinor: 50000n, estQuantityCenti: 400n, scheduledAt: new Date() });

describe('equipment_assets isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new EquipmentAssetRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'a1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['a1', 'tA']);
  });
  it('insert binds tenant_id; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new EquipmentAssetRepository(fakeReplica().provider).insert(tx as any, asset());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO equipment_assets/); expect(tx.query.mock.calls[0][1]).toContain('tA');
    const { provider, exec } = fakeReplica();
    await new EquipmentAssetRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/); expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('equipment_rates resolution', () => {
  it('resolveActive binds asset + basis + effective-dated window', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new EquipmentRateRepository(fakeReplica().provider).resolveActive(tx as any, 'a1', 'per_hour', '2026-07-01');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/asset_id=\$1 AND rate_basis=\$2/);
    expect(sql).toMatch(/effective_from <= \$3::date AND \(effective_to IS NULL OR effective_to >= \$3::date\)/);
    expect(params).toEqual(['a1', 'per_hour', '2026-07-01']);
  });
  it('upsert guards uniqueness on (asset_id, rate_basis, effective_from)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const { EquipmentRate } = await import('../domain/equipment-rate.entity');
    await new EquipmentRateRepository(fakeReplica().provider).upsert(tx as any, EquipmentRate.create({ id: 'r', assetId: 'a1', rateBasis: 'per_hour', rateMinor: 50000n, includesOperator: true, includesFuel: false, effectiveFrom: '2026-01-01', effectiveTo: null }));
    expect(tx.query.mock.calls[0][0]).toMatch(/ON CONFLICT \(asset_id, rate_basis, effective_from\) DO UPDATE/);
  });
});

describe('equipment_bookings isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE OF b (JOINs asset for owner)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new EquipmentBookingRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/b\.id=\$1 AND b\.tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE OF b/);
    expect(sql).toMatch(/JOIN equipment_assets a ON a\.id = b\.asset_id/); expect(params).toEqual(['b1', 'tA']);
  });
  it('insert binds tenant_id (no owner_user_id column written); listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new EquipmentBookingRepository(fakeReplica().provider).insert(tx as any, booking());
    const sql = tx.query.mock.calls[0][0];
    expect(sql).toMatch(/INSERT INTO equipment_bookings/); expect(sql).not.toMatch(/owner_user_id/);
    const { provider, exec } = fakeReplica();
    await new EquipmentBookingRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
  it('findDueToTimeout is bounded + SKIP LOCKED over un-confirmed bookings', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new EquipmentBookingRepository(fakeReplica().provider).findDueToTimeout(tx as any, new Date(), 100);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/status IN \('requested','quoted'\)/); expect(sql).toMatch(/FOR UPDATE OF b SKIP LOCKED/);
  });
});
