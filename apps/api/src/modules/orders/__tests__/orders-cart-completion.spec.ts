// modules/orders/__tests__/orders-cart-completion.spec.ts
// Unit-level SQL-contract + math tests for the API-W3-10 sub-domain (cart-item / checkout-group /
// order-item repos + the tenant order-stats read-model). Tenant scoping (Law 1) + partition pruning
// (Law 8) are asserted against the generated SQL; the stats GMV math is asserted against stubbed rows.
// Cross-tenant RLS denial + the full persistence path are covered by orders.integration.spec.ts.
import { CartItemRepository } from '../repositories/cart-item.repository';
import { CheckoutGroupRepository } from '../repositories/checkout-group.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { TenantOrderStatsReadModel } from '../read-models/tenant-order-stats.read-model';

function replicaReturning(rows: any[]) { const exec = { query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('cart-item repository SQL contract', () => {
  it('itemsForUpdate row-locks the cart lines', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CartItemRepository(replicaReturning([]).provider).itemsForUpdate(tx as any, 'cart1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/FROM cart_items WHERE cart_id=\$1/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['cart1']);
  });
  it('listByCart is bounded (LIMIT)', async () => {
    const { provider, exec } = replicaReturning([]);
    await new CartItemRepository(provider).listByCart('tenantA', 'cart1');
    expect(exec.query.mock.calls[0][0]).toMatch(/LIMIT \d+/);
  });
});

describe('checkout-group repository SQL contract', () => {
  it('getById is tenant-scoped', async () => {
    const { provider, exec } = replicaReturning([]);
    await new CheckoutGroupRepository(provider).getById('tenantA', 'g1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2/);
    expect(params).toEqual(['g1', 'tenantA']);
  });
  it('ordersInGroup is tenant-scoped + bounded', async () => {
    const { provider, exec } = replicaReturning([]);
    await new CheckoutGroupRepository(provider).ordersInGroup('tenantA', 'g1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND checkout_group_id=\$2/);
    expect(sql).toMatch(/LIMIT \d+/);
    expect(params).toEqual(['tenantA', 'g1']);
  });
});

describe('order-item repository SQL contract', () => {
  it('listByOrder is tenant-scoped + partition-pruned (uuid_v7_time)', async () => {
    const { provider, exec } = replicaReturning([]);
    await new OrderItemRepository(provider).listByOrder('tenantA', 'o1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND order_id=\$2/);
    expect(sql).toMatch(/uuid_v7_time\(\$2\)/);
    expect(params).toEqual(['tenantA', 'o1']);
  });
  it('recordDelivered is tenant-scoped + partition-pruned + line-targeted', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const n = await new OrderItemRepository(replicaReturning([]).provider).recordDelivered(tx as any, 'tenantA', 'o1', 'L1', 5);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE order_items SET delivered_quantity=\$4/);
    expect(sql).toMatch(/uuid_v7_time\(\$2\)/);
    expect(sql).toMatch(/listing_id=\$3/);
    expect(params).toEqual(['tenantA', 'o1', 'L1', 5]);
    expect(n).toBe(1);
  });
});

describe('tenant order-stats read-model', () => {
  it('GMV counts only delivered + completed; totalOrders counts all buckets', async () => {
    const rows = [
      { status: 'created', n: '4', gross: '40000' },
      { status: 'delivered', n: '3', gross: '30000' },
      { status: 'completed', n: '2', gross: '25000' },
      { status: 'cancelled', n: '1', gross: '10000' },
    ];
    const { provider } = replicaReturning(rows);
    const out = await new TenantOrderStatsReadModel(provider).stats('tenantA', {});
    expect(out.totalOrders).toBe(10);
    expect(out.gmvMinor).toBe('55000');   // 30000 (delivered) + 25000 (completed) only
    expect(out.sellerUserId).toBeNull();
  });
  it('scopes to a seller when not a moderator (adds seller_user_id filter + param)', async () => {
    const { provider, exec } = replicaReturning([]);
    const out = await new TenantOrderStatsReadModel(provider).stats('tenantA', { sellerUserId: 'sellerX', windowDays: 7 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/seller_user_id=\$3/);
    expect(params).toEqual(['tenantA', '7', 'sellerX']);
    expect(out.sellerUserId).toBe('sellerX');
  });
});
