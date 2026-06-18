// modules/logistics/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every shipment read/write binds tenant_id (Law 1) and prunes partitions via uuid_v7_time (Law 8).
// No version column → mutations lock the row FOR UPDATE; lists are keyset (never OFFSET).
import { ShipmentRepository } from '../repositories/shipment.repository';
import { Shipment } from '../domain/shipment.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const repo = () => new ShipmentRepository(fakeReplica().provider);

describe('logistics tenant isolation (SQL contract)', () => {
  it('getForUpdate binds tenant_id, prunes partitions, and row-locks', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await repo().getForUpdate(tx as any, 'tenantA', 's1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/);
    expect(sql).toMatch(/uuid_v7_time\(\$1\)/);   // partition prune (Law 8)
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['s1', 'tenantA']);
  });

  it('existsForOrder binds tenant_id + order_id (idempotency guard)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await repo().existsForOrder(tx as any, 'tenantA', 'o1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND order_id=\$2/);
    expect(params).toEqual(['tenantA', 'o1']);
  });

  it('insert binds tenant_id and writes no version column', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const s = Shipment.create({ id: 's1', tenantId: 'tenantA', orderId: 'o1' });
    await repo().insert(tx as any, s);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO shipments/);
    expect(sql).not.toMatch(/version/);
    expect(params).toContain('tenantA');
  });

  it('update is tenant-scoped + partition-keyed, with NO version clause', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const s = Shipment.create({ id: 's1', tenantId: 'tenantA', orderId: 'o1' });
    await repo().update(tx as any, s, 'pending');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2 AND created_at=\$3/);
    expect(sql).not.toMatch(/version/);
    expect(params[1]).toBe('tenantA');
  });

  it('listFor binds tenant_id and is keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new ShipmentRepository(provider).listFor('tenantA', { limit: 20 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/);
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(sql).not.toMatch(/OFFSET/i);
    expect(params[0]).toBe('tenantA');
  });

  it('shipment_events tracking row binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await repo().recordEvent(tx as any, 'tenantA', 's1', 'assigned', null);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO shipment_events/);
    expect(params).toContain('tenantA');
  });
});
