// modules/livestock/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every animal/vet/booking read+write binds tenant_id (Law 1). No version columns → mutations lock FOR
// UPDATE. Lists are keyset (never OFFSET). vet_service type + animal master data resolve platform-scoped
// (tenant_id IS NULL / global), never from a client-supplied id (anti-IDOR).
import { AnimalRepository } from '../repositories/animal.repository';
import { VetProfileRepository } from '../repositories/vet-profile.repository';
import { VetServiceRepository } from '../repositories/vet-service.repository';
import { VetBookingRepository } from '../repositories/vet-booking.repository';
import { Animal } from '../domain/animal.entity';
import { VetBooking } from '../domain/vet-booking.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const animal = () => Animal.rehydrate({ id: 'an1', tenantId: 'tenantA', ownerUserId: 'u1', speciesId: 'sp1', breedId: null, pashuAadhaar: null,
  name: null, sex: null, dobEstimated: null, parity: null, lactationStage: null, currentYieldLpd: null, pregnancyStatus: null, bodyConditionScore: null, status: 'active', acquiredVia: null });
const booking = () => VetBooking.rehydrate({ id: 'b1', tenantId: 'tenantA', farmerUserId: 'f1', vetId: 'v1', serviceId: 's1', animalId: null,
  urgency: 'routine', mode: 'visit', symptomsText: null, scheduledAt: null, status: 'requested', feeMinor: 30000n, completedAt: null });

describe('animals isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new AnimalRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'an1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['an1', 'tenantA']);
  });
  it('insert binds tenant_id; listFor is keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new AnimalRepository(fakeReplica().provider).insert(tx as any, animal());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO animals/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new AnimalRepository(provider).listFor('tenantA', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
});

describe('vet_profiles isolation', () => {
  it('findByUser binds tenant_id + user_id', async () => {
    const { provider, exec } = fakeReplica();
    await new VetProfileRepository(provider).findByUser('tenantA', 'u1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND user_id=\$2/); expect(params).toEqual(['tenantA', 'u1']);
  });
  it('listFor keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new VetProfileRepository(provider).listFor('tenantA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('vet_services type resolution (anti-IDOR)', () => {
  it('resolveServiceTypeId is platform-scoped (tenant_id IS NULL), never a client id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'st1' }], rowCount: 1 }) };
    await new VetServiceRepository(fakeReplica().provider).resolveServiceTypeId(tx as any, 'consult');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/type_code='vet_service'/); expect(sql).toMatch(/tenant_id IS NULL/); expect(params).toEqual(['consult']);
  });
  it('upsert guards uniqueness on (vet_id, service_type_id)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const { VetService } = await import('../domain/vet-service.entity');
    await new VetServiceRepository(fakeReplica().provider).upsert(tx as any, VetService.create({ id: 's1', vetId: 'v1', serviceTypeId: 'st1', priceMinor: 30000n }));
    expect(tx.query.mock.calls[0][0]).toMatch(/ON CONFLICT \(vet_id, service_type_id\) DO UPDATE/);
  });
});

describe('vet_bookings isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new VetBookingRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['b1', 'tenantA']);
  });
  it('insert binds tenant_id; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new VetBookingRepository(fakeReplica().provider).insert(tx as any, booking());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO vet_bookings/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new VetBookingRepository(provider).listFor('tenantA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});
