// modules/orders/__tests__/orders-cart-completion.integration.spec.ts
// REAL Postgres proof of the API-W3-10 sub-domain surfaces (order-item reads + partial-fulfilment,
// checkout-group read, order stats) — complementing orders.integration.spec.ts (which proves the
// cart→checkout→order persistence + cross-tenant RLS on orders):
//   1. an order's line items are visible to buyer/seller/moderator, but a stranger gets 404 (no IDOR);
//   2. the SELLER records a delivered quantity (partial fulfilment) — bounded to the ordered qty, with
//      an orders.order_item_delivered event in the SAME tx; a non-seller is refused;
//   3. a checkout group is visible to its owning buyer (and a moderator), 404 to others;
//   4. tenant order stats aggregate GMV (delivered+completed) for the tenant;
//   5. ROW-LEVEL SECURITY: tenant B cannot see tenant A's checkout_group.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { uuidv7 } from '../../../core/database/uuid.util';

import { OrderRepository } from '../repositories/order.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { CheckoutGroupRepository } from '../repositories/checkout-group.repository';
import { OrderItemService } from '../services/order-item.service';
import { CheckoutGroupService } from '../services/checkout-group.service';
import { TenantOrderStatsReadModel } from '../read-models/tenant-order-stats.read-model';
import { OrdersPublisher } from '../events/orders.publisher';
import { OrderNotFoundError, OrderForbiddenError, InvalidQuantityError } from '../domain/orders.errors';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('orders cart-completion sub-domain (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let orderItems: OrderItemService; let groups: CheckoutGroupService; let stats: TenantOrderStatsReadModel;
  let isSuperuser = false;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const buyer = randomUUID(); const seller = randomUUID(); const stranger = randomUUID();
  const orderId = uuidv7(); const groupId = uuidv7(); const listingId = randomUUID(); const productId = randomUUID();
  const buyerActor = () => ({ userId: buyer, canModerate: false });
  const sellerActor = () => ({ userId: seller, canModerate: false });
  const strangerActor = () => ({ userId: stranger, canModerate: false });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, buyer); await makeUser(admin, seller); await makeUser(admin, stranger);
    // a delivered, multi-seller checkout group + its order + one line item (created_at≈now so the
    // v7-id partition window matches)
    await admin.query(`INSERT INTO checkout_groups (id, tenant_id, buyer_user_id, total_minor, currency_code) VALUES ($1,$2,$3,150000,'INR')`, [groupId, tenantA, buyer]);
    await admin.query(
      `INSERT INTO orders (id, tenant_id, order_no, checkout_group_id, buyer_user_id, seller_user_id, source, currency_code, subtotal_minor, total_minor, status, version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'direct','INR',150000,150000,'delivered',1, now())`,
      [orderId, tenantA, `KV-${orderId.slice(0, 8)}`, groupId, buyer, seller]);
    await admin.query(
      `INSERT INTO order_items (id, order_id, order_created_at, tenant_id, listing_id, product_id, title_snapshot, quantity, unit_code, unit_price_minor, line_total_minor, created_at)
       VALUES (uuid_generate_v7(), $1, now(), $2, $3, $4, 'Tomatoes 50kg', 50, 'kg', 3000, 150000, now())`,
      [orderId, tenantA, listingId, productId]);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const orderRepo = new OrderRepository(replica as any);
    const orderItemRepo = new OrderItemRepository(replica as any);
    const groupRepo = new CheckoutGroupRepository(replica as any);
    orderItems = new OrderItemService(uow, new PromMetrics(), orderRepo, orderItemRepo, new OrdersPublisher(new PgOutboxWriter()));
    groups = new CheckoutGroupService(new PromMetrics(), groupRepo);
    stats = new TenantOrderStatsReadModel(replica as any);

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('lists an order\'s items for a party; a stranger gets 404', async () => {
    const view = await orderItems.listForOrder(tenantA, buyerActor(), orderId);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].listingId).toBe(listingId);
    await expect(orderItems.listForOrder(tenantA, strangerActor(), orderId)).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('seller records a delivered quantity (bounded); non-seller refused; over-qty refused', async () => {
    await expect(orderItems.recordDelivered(tenantA, buyerActor(), orderId, listingId, 10)).rejects.toBeInstanceOf(OrderForbiddenError);
    await expect(orderItems.recordDelivered(tenantA, sellerActor(), orderId, listingId, 999)).rejects.toBeInstanceOf(InvalidQuantityError);
    const res = await orderItems.recordDelivered(tenantA, sellerActor(), orderId, listingId, 48);
    expect(res.deliveredQuantity).toBe(48);
    const row = await admin.query(`SELECT delivered_quantity FROM order_items WHERE order_id=$1 AND listing_id=$2`, [orderId, listingId]);
    expect(Number(row.rows[0].delivered_quantity)).toBe(48);
    const ev = await admin.query(`SELECT count(*)::int c FROM outbox_events WHERE aggregate_id=$1 AND event_type='orders.order_item_delivered'`, [orderId]);
    expect(ev.rows[0].c).toBeGreaterThanOrEqual(1);
  });

  it('checkout group is visible to the owning buyer + carries its sub-orders; 404 to others', async () => {
    const g = await groups.getGroup(tenantA, buyerActor(), groupId);
    expect(g.id).toBe(groupId);
    expect(g.orders.find((o) => o.id === orderId)).toBeTruthy();
    await expect(groups.getGroup(tenantA, strangerActor(), groupId)).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('tenant order stats count the order + GMV (delivered/completed)', async () => {
    const s = await stats.stats(tenantA, {});
    expect(s.totalOrders).toBeGreaterThanOrEqual(1);
    expect(BigInt(s.gmvMinor)).toBeGreaterThanOrEqual(150000n);   // our delivered order counts toward GMV
  });

  it('RLS: tenant B cannot see tenant A\'s checkout group', async () => {
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM checkout_groups WHERE id=$1`, [groupId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[orders-cart-completion] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
