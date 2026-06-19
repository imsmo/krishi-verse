// modules/warehousing/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every warehouse/booking/assay/NWR read+write binds tenant_id (Law 1). No version columns → mutations lock
// FOR UPDATE. Lists are keyset (never OFFSET). Warehouse browse includes platform-global (NULL-tenant) rows
// per the 0014 RLS policy; the bookable read is own-OR-NULL. NWR active-guard is one-per-booking.
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { StorageBookingRepository } from '../repositories/storage-booking.repository';
import { AssayReportRepository } from '../repositories/assay-report.repository';
import { NwrReceiptRepository } from '../repositories/nwr-receipt.repository';
import { Warehouse } from '../domain/warehouse.entity';
import { StorageBooking } from '../domain/storage-booking.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('warehouses isolation + platform-global browse', () => {
  it('getBookable reads own-OR-NULL-tenant (cross-tenant marketplace listings)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new WarehouseRepository(fakeReplica().provider).getBookable('tA', 'w1', tx as any);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND \(tenant_id=\$2 OR tenant_id IS NULL\)/); expect(params).toEqual(['w1', 'tA']);
  });
  it('getForUpdate is strictly tenant-owned + FOR UPDATE (no NULL-tenant edits)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new WarehouseRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'w1');
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(sql).not.toMatch(/tenant_id IS NULL/);
  });
  it('browse listFor includes NULL-tenant; no OFFSET', async () => {
    const { provider, exec } = fakeReplica();
    await new WarehouseRepository(provider).listFor('tA', { box: 'browse', activeOnly: true, limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/\(tenant_id=\$1 OR tenant_id IS NULL\)/); expect(sql).not.toMatch(/OFFSET/i);
  });
});

describe('storage_bookings isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new StorageBookingRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['b1', 'tA']);
  });
  it('insert binds tenant_id; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const b = StorageBooking.request({ id: 'b1', tenantId: 'tA', warehouseId: 'w1', depositorUserId: 'd1', productId: 'p1', quantityMilli: 1000n, unitCode: 'quintal', expectedArrival: null });
    await new StorageBookingRepository(fakeReplica().provider).insert(tx as any, b);
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO storage_bookings/); expect(tx.query.mock.calls[0][1]).toContain('tA');
    const { provider, exec } = fakeReplica();
    await new StorageBookingRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('assay_reports + nwr_receipts isolation', () => {
  it('assay listForBooking binds tenant_id + booking', async () => {
    const { provider, exec } = fakeReplica();
    await new AssayReportRepository(provider).listForBooking('tA', 'b1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND storage_booking_id=\$2/); expect(params).toEqual(['tA', 'b1']);
  });
  it('nwr findActiveForBooking guards one active receipt per booking, tenant-bound', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new NwrReceiptRepository(fakeReplica().provider).findActiveForBooking(tx as any, 'tA', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND storage_booking_id=\$2 AND status IN \('issued','pledged','partially_released'\)/);
    expect(params).toEqual(['tA', 'b1']);
  });
  it('nwr getForUpdate binds tenant_id + FOR UPDATE; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new NwrReceiptRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'n1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const { provider, exec } = fakeReplica();
    await new NwrReceiptRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});
