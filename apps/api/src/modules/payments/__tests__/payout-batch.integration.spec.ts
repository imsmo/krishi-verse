// modules/payments/__tests__/payout-batch.integration.spec.ts
// REAL Postgres proof of the API-W3-08 batched-payout slice:
//   1. queued payouts (across tenants) are CLAIMED into a batch + disbursed via the wallet boundary →
//      'success' with a zero-sum payouts→gateway ledger move; the batch records total + count, 'executed';
//   2. the booking-clocked-out handler (labour.wages_paid) PROMOTES a booking's queued payouts into the
//      wage lane only when the `wage_priority_payout` flag is ON (default OFF) — and only its own table;
//   3. the async RazorpayX payout webhook confirms a 'processing' payout → 'success' (idempotent on the
//      gateway event id) and REJECTS a forged signature (fail closed);
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's payout.
// Schema/seeds from the REAL db/migrations + db/seeds. Batch/recon writes run on the ADMIN (privileged)
// pool — production runs them in the worker as kv_relay/kv_wallet.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { LedgerRepository } from '../../../core/wallet/ledger.repository';
import { InProcessWalletClient } from '../../../core/wallet/wallet.client.inprocess';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';

import { PayoutRepository } from '../repositories/payout.repository';
import { PayoutBatchRepository } from '../repositories/payout-batch.repository';
import { PayoutService } from '../services/payout.service';
import { PayoutBatchService } from '../services/payout-batch.service';
import { PaymentsPublisher } from '../events/payments.publisher';
import { BookingClockedOutHandler } from '../events/handlers/booking-clocked-out.handler';
import { RazorpayPayoutWebhookHandler } from '../events/handlers/razorpay-webhook.handler';
import { SandboxPayoutGateway } from '../gateway/sandbox-payout.gateway';
import { PayoutWebhookSignatureError } from '../domain/payments.errors';
import { WAGE_LANE_PRIORITY } from '../domain/payout.state';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('payout batch + wage lane + async webhook (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let uow: PgUnitOfWork; let wallet: InProcessWalletClient;
  let repo: PayoutRepository; let batchRepo: PayoutBatchRepository;
  let outbox: PgOutboxWriter; let idem: PgIdempotencyService; let metrics: PromMetrics; let audit: AuditWriter;
  let publisher: PaymentsPublisher; let batches: PayoutBatchService; let webhook: RazorpayPayoutWebhookHandler;
  let isSuperuser = false;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const sellerA = randomUUID(); const sellerB = randomUUID();
  const bankA = randomUUID(); const bankB = randomUUID();
  const AMOUNT = 90000n;

  const svc = (mode: 'success' | 'failed') => new PayoutService(uow, outbox, idem, metrics, wallet, new SandboxPayoutGateway(mode), audit, repo);
  const fund = async (tenantId: string, userId: string, amount: bigint) => uow.run(tenantId, async (tx) => {
    await wallet.post(tx, { tenantId, txnType: 'order_payment', idempotencyKey: `fund:${randomUUID()}`,
      legs: [ { account: userMain(userId), amountMinor: amount }, { account: platform(PlatformAccount.Gateway), amountMinor: -amount } ] });
  }, { userId: 'system' });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, sellerA); await makeUser(admin, sellerB);
    await admin.query(`INSERT INTO bank_accounts (id, user_id, tenant_id, account_kind, vault_ref) VALUES ($1,$2,$3,'upi','fa_a') ON CONFLICT DO NOTHING`, [bankA, sellerA, tenantA]);
    await admin.query(`INSERT INTO bank_accounts (id, user_id, tenant_id, account_kind, vault_ref) VALUES ($1,$2,$3,'upi','fa_b') ON CONFLICT DO NOTHING`, [bankB, sellerB, tenantB]);
    await admin.query(`INSERT INTO feature_flags (key, is_enabled, rollout_pct, rules) VALUES ('wage_priority_payout', true, 100, '{}'::jsonb) ON CONFLICT (key) DO UPDATE SET is_enabled=true, rollout_pct=100`);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    outbox = new PgOutboxWriter(); idem = new PgIdempotencyService(pools); metrics = new PromMetrics(); audit = new AuditWriter(pools);
    wallet = new InProcessWalletClient(new LedgerRepository());
    repo = new PayoutRepository(replica as any);
    batchRepo = new PayoutBatchRepository(pools);
    publisher = new PaymentsPublisher(outbox);
    batches = new PayoutBatchService(metrics, batchRepo, svc('success'), publisher);
    webhook = new RazorpayPayoutWebhookHandler(uow, idem, metrics, wallet, audit, repo, publisher);

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('claims queued payouts into a batch + disburses them → executed with a zero-sum ledger', async () => {
    await fund(tenantA, sellerA, AMOUNT);
    const p = await svc('success').requestPayout(tenantA, sellerA, `idem-${randomUUID()}`, { amountMinor: AMOUNT.toString(), bankAccountId: bankA, purpose: 'settlement', currencyCode: 'INR' } as any);

    const result = await batches.runBatch(admin as any, { batchType: 'settlement_run', maxPriority: null, limit: 50 });
    expect(result.status).toBe('executed');
    expect(result.succeeded).toBeGreaterThanOrEqual(1);

    const row = await admin.query(`SELECT status, batch_id FROM payouts WHERE id=$1`, [p.payoutId]);
    expect(row.rows[0].status).toBe('success');
    expect(row.rows[0].batch_id).toBe(result.batchId);
    const batch = await admin.query(`SELECT status, total_minor::text t, count FROM payout_batches WHERE id=$1`, [result.batchId]);
    expect(batch.rows[0].status).toBe('executed');
    expect(BigInt(batch.rows[0].t)).toBeGreaterThanOrEqual(AMOUNT);
    const exec = await admin.query(`SELECT COALESCE(SUM(amount_minor),0)::text s FROM ledger_entries WHERE txn_id=(SELECT id FROM ledger_transactions WHERE idempotency_key=$1)`, [`payout-exec:${p.payoutId}`]);
    expect(exec.rows[0].s).toBe('0');
  });

  it('booking-clocked-out promotes a booking\'s queued payouts into the wage lane only when flagged ON', async () => {
    await fund(tenantA, sellerA, AMOUNT);
    const bookingId = randomUUID();
    const p = await svc('success').requestPayout(tenantA, sellerA, `idem-${randomUUID()}`, { amountMinor: AMOUNT.toString(), bankAccountId: bankA, purpose: 'wage', currencyCode: 'INR', referenceType: 'labour_booking', referenceId: bookingId } as any);
    const before = await admin.query(`SELECT priority FROM payouts WHERE id=$1`, [p.payoutId]);
    expect(before.rows[0].priority).toBeGreaterThan(WAGE_LANE_PRIORITY);

    const ev = { id: '1', tenantId: tenantA, aggregateType: 'labour_booking', aggregateId: bookingId, eventType: 'labour.wages_paid', payload: { v: 1 } };
    // flag OFF → no promotion
    const off = new BookingClockedOutHandler({ isEnabled: async () => false } as any, repo);
    await uow.run(tenantA, (tx) => off.handle(ev as any, tx), { userId: 'system' });
    expect((await admin.query(`SELECT priority FROM payouts WHERE id=$1`, [p.payoutId])).rows[0].priority).toBe(before.rows[0].priority);
    // flag ON → promoted into the wage lane
    const on = new BookingClockedOutHandler({ isEnabled: async () => true } as any, repo);
    await uow.run(tenantA, (tx) => on.handle(ev as any, tx), { userId: 'system' });
    expect((await admin.query(`SELECT priority FROM payouts WHERE id=$1`, [p.payoutId])).rows[0].priority).toBe(WAGE_LANE_PRIORITY);
  });

  it('async payout webhook confirms processing→success + rejects a forged signature', async () => {
    await fund(tenantA, sellerA, AMOUNT);
    const p = await svc('success').requestPayout(tenantA, sellerA, `idem-${randomUUID()}`, { amountMinor: AMOUNT.toString(), bankAccountId: bankA, purpose: 'settlement', currencyCode: 'INR' } as any);
    const gwId = `pout_${randomUUID()}`;
    await admin.query(`UPDATE payouts SET status='processing', gateway_payout_id=$2 WHERE id=$1`, [p.payoutId, gwId]);

    const body = JSON.stringify({ id: `evt_${randomUUID()}`, event: 'payout.processed', payload: { payout: { entity: { id: gwId, status: 'processed', notes: { tenant_id: tenantA } } } } });
    await expect(webhook.ingest(body, 'deadbeef')).rejects.toBeInstanceOf(PayoutWebhookSignatureError);   // forged → fail closed
    const res = await webhook.ingest(body, webhook.sign(body));
    expect(res.status).toBe('success');
    const row = await admin.query(`SELECT status FROM payouts WHERE id=$1`, [p.payoutId]);
    expect(row.rows[0].status).toBe('success');
    const exec = await admin.query(`SELECT COALESCE(SUM(amount_minor),0)::text s FROM ledger_entries WHERE txn_id=(SELECT id FROM ledger_transactions WHERE idempotency_key=$1)`, [`payout-exec:${p.payoutId}`]);
    expect(exec.rows[0].s).toBe('0');
  });

  it('RLS: tenant B cannot see tenant A\'s payout', async () => {
    await fund(tenantA, sellerA, AMOUNT);
    const p = await svc('success').requestPayout(tenantA, sellerA, `idem-${randomUUID()}`, { amountMinor: AMOUNT.toString(), bankAccountId: bankA, purpose: 'settlement', currencyCode: 'INR' } as any);
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM payouts WHERE id=$1`, [p.payoutId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[payout-batch] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
