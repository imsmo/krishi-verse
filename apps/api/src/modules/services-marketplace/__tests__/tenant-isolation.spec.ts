// modules/services-marketplace/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every offering/booking read+write binds tenant_id (Law 1). No version columns → mutations lock FOR UPDATE.
// Lists are keyset (never OFFSET). The booking's provider is JOINed from service_offerings (not a client id),
// so authz + settlement resolve the payee server-side (anti-IDOR). Real RLS enforcement = integration.
import { ServiceOfferingRepository } from '../repositories/service-offering.repository';
import { ServiceBookingRepository } from '../repositories/service-booking.repository';
import { ServiceOffering } from '../domain/service-offering.entity';
import { ServiceBooking } from '../domain/service-booking.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const offering = () => ServiceOffering.rehydrate({ id: 'o1', tenantId: 'tenantA', providerUserId: 'prov', categoryId: 'c1', defaultTitle: 'Ploughing', description: null,
  pricingModel: 'per_visit', priceMinor: 50000n, currencyCode: 'INR', capacityPerSlot: null, serviceRadiusKm: 20, addressId: null, status: 'draft' });
const booking = () => ServiceBooking.rehydrate({ id: 'b1', tenantId: 'tenantA', offeringId: 'o1', providerUserId: 'prov', customerUserId: 'cust', bookingNo: 'SB-1',
  startsAt: new Date(), endsAt: null, guests: 1, totalMinor: 50000n, status: 'requested', notes: null });

describe('service_offerings isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ServiceOfferingRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'o1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['o1', 'tenantA']);
  });
  it('insert binds tenant_id; listFor is keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new ServiceOfferingRepository(fakeReplica().provider).insert(tx as any, offering());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO service_offerings/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new ServiceOfferingRepository(provider).listFor('tenantA', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('browse box filters to published only', async () => {
    const { provider, exec } = fakeReplica();
    await new ServiceOfferingRepository(provider).listFor('tenantA', { browse: true, limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/status='published'/);
  });
});

describe('service_bookings isolation', () => {
  it('getForUpdate binds tenant_id, JOINs the offering for provider, locks FOR UPDATE OF b', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ServiceBookingRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/b\.id=\$1 AND b\.tenant_id=\$2/); expect(sql).toMatch(/JOIN service_offerings o ON o\.id = b\.offering_id/);
    expect(sql).toMatch(/FOR UPDATE OF b/); expect(params).toEqual(['b1', 'tenantA']);
  });
  it('insert binds tenant_id and does NOT write provider_user_id (derived via JOIN)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new ServiceBookingRepository(fakeReplica().provider).insert(tx as any, booking());
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO service_bookings/); expect(sql).not.toMatch(/provider_user_id/); expect(params).toContain('tenantA');
  });
  it('listFor filters provider via the JOINed offering column; keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new ServiceBookingRepository(provider).listFor('tenantA', { providerUserId: 'prov', limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/o\.provider_user_id=/); expect(sql).toMatch(/ORDER BY b\.created_at DESC, b\.id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
});
