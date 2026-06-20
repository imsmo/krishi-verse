// modules/services-marketplace/__tests__/services-marketplace.integration.spec.ts
// REAL end-to-end proof of the services-marketplace spine against a live Postgres:
//   1. a provider creates a per_person offering (₹100/head) and publishes it;
//   2. a customer requests a booking for 3 guests → total is SNAPSHOTTED at ₹300 from the offering (never the
//      client) → provider accepts → starts → customer completes-and-pays (customer → provider, ZERO-SUM,
//      service_fee) → balances move by exactly ₹300 and the booking is completed;
//   3. ROW-LEVEL SECURITY: tenant B cannot see tenant A's booking.
// Schema/seeds come from the REAL db/migrations (0015 offerings/bookings, 0020 RLS backfill) + db/seeds.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser, makeCategory } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { LedgerRepository } from '../../../core/wallet/ledger.repository';
import { InProcessWalletClient } from '../../../core/wallet/wallet.client.inprocess';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { QuotaService } from '../../../core/quota/quota.service';

import { ServiceOfferingRepository } from '../repositories/service-offering.repository';
import { ServiceBookingRepository } from '../repositories/service-booking.repository';
import { ServiceOfferingService } from '../services/service-offering.service';
import { ServiceBookingService } from '../services/service-booking.service';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;
class AllowAllQuota extends QuotaService { async assertWithinLimit(): Promise<void> {} async increment(): Promise<void> {} }

run('services-marketplace spine (integration, real Postgres + RLS + fee settlement)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool; let uow: PgUnitOfWork; let wallet: InProcessWalletClient;
  let offerings: ServiceOfferingService; let bookings: ServiceBookingService;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const provider = randomUUID(); const customer = randomUUID();
  let categoryId = ''; let offeringId = ''; let bookingId = '';
  const providerActor = { userId: provider, canOffer: true, canBook: false, isAdmin: false };
  const customerActor = { userId: customer, canOffer: false, canBook: true, isAdmin: false };

  const balUser = async (u: string) => BigInt((await admin.query(`SELECT COALESCE(cached_balance_minor,0) b FROM wallet_accounts WHERE owner_kind='user' AND account_code='main' AND owner_user_id=$1`, [u])).rows[0]?.b ?? '0');
  const fund = (u: string, amount: bigint) => uow.run(tenantA, (tx) => wallet.post(tx, { tenantId: tenantA, txnType: 'order_payment', idempotencyKey: `fund:${randomUUID()}`, initiatedBy: 'system', legs: [{ account: userMain(u), amountMinor: amount }, { account: platform(PlatformAccount.Gateway), amountMinor: -amount }] }), { userId: 'system' });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, provider); await makeUser(admin, customer);
    categoryId = await makeCategory(admin);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter(); const idem = new PgIdempotencyService(pools); const metrics = new PromMetrics();
    wallet = new InProcessWalletClient(new LedgerRepository());
    const offeringRepo = new ServiceOfferingRepository(replica as any); const bookingRepo = new ServiceBookingRepository(replica as any);
    offerings = new ServiceOfferingService(uow, outbox, idem, new AllowAllQuota(), metrics, offeringRepo);
    bookings = new ServiceBookingService(uow, outbox, idem, metrics, wallet, bookingRepo, offeringRepo);

    await fund(customer, 1_000_000n);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('provider creates + publishes a per_person offering', async () => {
    const o: any = await offerings.create(tenantA, providerActor, `idem-${randomUUID()}`, { categoryId, defaultTitle: 'Harvest crew', pricingModel: 'per_person', priceMinor: '10000' } as any);
    offeringId = o.id; expect(o.status).toBe('draft');
    expect((await offerings.setStatus(tenantA, providerActor, offeringId, 'publish')).status).toBe('published');
  });

  it('customer requests → total snapshotted at ₹300 (₹100 × 3 guests, not the client)', async () => {
    const b: any = await bookings.request(tenantA, customerActor, `idem-${randomUUID()}`, { offeringId, startsAt: new Date().toISOString(), guests: 3 } as any);
    bookingId = b.id; expect(b.totalMinor).toBe('30000'); expect(b.providerUserId).toBe(provider); expect(b.status).toBe('requested');
  });

  it('provider accepts → starts; customer completes-and-pays (zero-sum customer→provider)', async () => {
    expect((await bookings.accept(tenantA, providerActor, bookingId)).status).toBe('confirmed');
    expect((await bookings.start(tenantA, providerActor, bookingId)).status).toBe('in_progress');
    const cBefore = await balUser(customer); const pBefore = await balUser(provider);
    const done: any = await bookings.completeAndPay(tenantA, customerActor, bookingId, `idem-${randomUUID()}`);
    expect(done.status).toBe('completed'); expect(done.feePaidMinor).toBe('30000');
    expect(cBefore - (await balUser(customer))).toBe(30000n);   // customer debited ₹300
    expect((await balUser(provider)) - pBefore).toBe(30000n);   // provider credited ₹300
  });

  it('completeAndPay is idempotent (replaying the same key moves no extra money)', async () => {
    const key = `idem-${randomUUID()}`;
    // booking already completed above; a fresh in_progress booking proves single-charge under replay
    const b2: any = await bookings.request(tenantA, customerActor, `idem-${randomUUID()}`, { offeringId, startsAt: new Date().toISOString(), guests: 1 } as any);
    await bookings.accept(tenantA, providerActor, b2.id); await bookings.start(tenantA, providerActor, b2.id);
    const pBefore = await balUser(provider);
    await bookings.completeAndPay(tenantA, customerActor, b2.id, key);
    await bookings.completeAndPay(tenantA, customerActor, b2.id, key);   // replay
    expect((await balUser(provider)) - pBefore).toBe(10000n);            // charged exactly once
  });

  it('RLS: tenant B cannot see tenant A\'s booking', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM service_bookings WHERE id=$1`, [bookingId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM service_bookings WHERE id=$1`, [bookingId])).rows.length).toBe(1);
  });
});
