// modules/orders/__tests__/tenant-isolation.spec.ts · tenant-scoping + partition-prune SQL
// contract (CI gate). Every order read/write MUST bind tenant_id (Law 1) and derive the
// partition window from the v7 id via uuid_v7_time() (Law 8) so Postgres prunes to one partition
// instead of scanning every monthly partition at billions of rows.
import { OrderRepository } from '../repositories/order.repository';
import { CartRepository } from '../repositories/cart.repository';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('orders tenant isolation + partition pruning (SQL contract)', () => {
  it('order.getForUpdate is tenant-scoped, partition-pruned (uuid_v7_time) and row-locked', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new OrderRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'o1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$2/);
    expect(sql).toMatch(/uuid_v7_time\(\$1\)/);   // prunes to one partition (Law 8)
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['o1', 'tenantA']);
  });

  it('order.getVisible restricts to buyer OR seller OR a moderator (no cross-party peeking)', async () => {
    const { provider, exec } = fakeReplica();
    await new OrderRepository(provider).getVisible('tenantA', 'o1', 'viewer1', false);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$2/);
    expect(sql).toMatch(/buyer_user_id=\$4 OR seller_user_id=\$4/);
    expect(sql).toMatch(/uuid_v7_time\(\$1\)/);
    expect(params).toEqual(['o1', 'tenantA', false, 'viewer1']);
  });

  it('order.update is optimistic-locked (version) on the exact partition row (id+created_at)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const o = Order.place({ id: 'o1', tenantId: 'tenantA', orderNo: 'KV-1', checkoutGroupId: null, buyerUserId: 'b', sellerUserId: 's',
      source: 'direct', currencyCode: 'INR', items: [OrderItem.of({ id: 'i1', orderId: 'o1', orderCreatedAt: new Date(), tenantId: 'tenantA',
      listingId: 'l1', productId: 'p1', titleSnapshot: 'X', quantity: 1, unitCode: 'quintal', unitPriceMinor: 100n, gstRatePct: null, hsnCode: null, batchId: null })],
      deliveryMethodId: null, deliveryAddressId: null, requiresPayment: false });
    await new OrderRepository(fakeReplica().provider).update(tx as any, o, 'created');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/version=version\+1/);
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2 AND created_at=\$3 AND version=\$9/);
    expect(params[1]).toBe('tenantA');
  });

  it('order.findDue (worker) is tenant-scoped, bounded to recent partitions and SKIP LOCKED', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new OrderRepository(fakeReplica().provider).findDue(tx as any, 'tenantA', ['created'], 'acceptance_deadline', new Date(), 100);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/);
    expect(sql).toMatch(/created_at > now\(\) - interval '60 days'/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(params[0]).toBe('tenantA');
  });

  it('cart.activeIdForUpdate binds tenant_id + user_id and row-locks', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CartRepository(fakeReplica().provider).activeIdForUpdate(tx as any, 'tenantA', 'user1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND user_id=\$2/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['tenantA', 'user1']);
  });
});
