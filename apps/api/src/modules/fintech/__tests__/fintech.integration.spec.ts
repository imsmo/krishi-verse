// modules/fintech/__tests__/fintech.integration.spec.ts
// REAL end-to-end proof of the fintech lending spine against a live Postgres:
//   1. a borrower applies for a ₹50,000 loan against the seeded crop-loan product (0208);
//   2. the lender reviews → approves with a 0h cooling-off → DISBURSES: the wallet moves tenant 'main' →
//      borrower userMain (zero-sum, loan_disbursement) and a servicing loan opens (outstanding = principal);
//   3. the borrower REPAYS in two parts → the loan CLOSES; the wallet returns the funds to the tenant pool
//      (zero-sum, loan_repayment); over-repayment is rejected;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's loan.
// Schema/seeds come from the REAL db/migrations + db/seeds (test/integration-global-setup.js).
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
import { userMain, platform, PlatformAccount, TenantAccount } from '../../../core/wallet/account-codes';
import { QuotaService } from '../../../core/quota/quota.service';

import { FinancialPartnerRepository } from '../repositories/financial-partner.repository';
import { LoanProductRepository } from '../repositories/loan-product.repository';
import { LoanApplicationRepository } from '../repositories/loan-application.repository';
import { LoanRepository } from '../repositories/loan.repository';
import { LoanRepaymentRepository } from '../repositories/loan-repayment.repository';
import { LoanApplicationService } from '../services/loan-application.service';
import { LoanService } from '../services/loan.service';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;
class AllowAllQuota extends QuotaService { async assertWithinLimit(): Promise<void> {} async increment(): Promise<void> {} }

const PRODUCT_ID = '22222222-0000-7000-8000-000000000101';   // seeded crop-loan product (db/seeds/rules/0208)

run('fintech lending spine (integration, real Postgres + RLS + disbursement/repayment)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool; let uow: PgUnitOfWork; let wallet: InProcessWalletClient;
  let apps: LoanApplicationService; let loansSvc: LoanService;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const borrower = randomUUID(); const lender = randomUUID();
  let appId = ''; let loanId = '';
  const borrowerActor = { userId: borrower, canBorrow: true, canManage: false };
  const lenderActor = { userId: lender, canBorrow: false, canManage: true };

  const balUser = async (u: string) => BigInt((await admin.query(`SELECT COALESCE(cached_balance_minor,0) b FROM wallet_accounts WHERE owner_kind='user' AND account_code='main' AND owner_user_id=$1`, [u])).rows[0]?.b ?? '0');
  const balTenant = async (t: string) => BigInt((await admin.query(`SELECT COALESCE(cached_balance_minor,0) b FROM wallet_accounts WHERE owner_kind='tenant' AND account_code='main' AND owner_tenant_id=$1`, [t])).rows[0]?.b ?? '0');
  const fundTenant = (t: string, amount: bigint) => uow.run(t, (tx) => wallet.post(tx, { tenantId: t, txnType: 'order_payment', idempotencyKey: `fund:${randomUUID()}`, initiatedBy: 'system',
    legs: [{ account: { kind: 'tenant', tenantId: t, accountCode: TenantAccount.Main, currencyCode: 'INR' }, amountMinor: amount }, { account: platform(PlatformAccount.Gateway), amountMinor: -amount }] }), { userId: 'system' });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, borrower); await makeUser(admin, lender);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter(); const idem = new PgIdempotencyService(pools); const metrics = new PromMetrics(); const audit = new AuditWriter(pools);
    wallet = new InProcessWalletClient(new LedgerRepository());
    void new FinancialPartnerRepository(replica as any);
    const productRepo = new LoanProductRepository(replica as any); const appRepo = new LoanApplicationRepository(replica as any);
    const loanRepo = new LoanRepository(replica as any); const repayRepo = new LoanRepaymentRepository(replica as any);
    apps = new LoanApplicationService(uow, outbox, idem, new AllowAllQuota(), metrics, audit, wallet, appRepo, loanRepo, productRepo);
    loansSvc = new LoanService(uow, outbox, idem, metrics, audit, wallet, loanRepo, repayRepo);

    await fundTenant(tenantA, 100_000_000n);   // FPO lending pool
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('borrower applies; lender reviews → approves (0h cooling-off)', async () => {
    appId = (await apps.apply(tenantA, borrowerActor, `idem-${randomUUID()}`, { productId: PRODUCT_ID, amountRequestedMinor: '5000000', purposeText: 'Seeds + fertiliser' } as any)).id;
    await apps.review(tenantA, lenderActor, appId);
    const approved = await apps.approve(tenantA, lenderActor, appId, { amountApprovedMinor: '5000000', coolingOffHours: 0 } as any, null);
    expect(approved.status).toBe('approved');
  });

  it('DISBURSE credits the borrower wallet (tenant → borrower, zero-sum); loan opens', async () => {
    const tBefore = await balTenant(tenantA); const bBefore = await balUser(borrower);
    const out: any = await apps.disburse(tenantA, lenderActor, appId, `idem-${randomUUID()}`, null);
    loanId = out.loan.id; expect(out.loan.status).toBe('active'); expect(out.loan.outstandingMinor).toBe('5000000');
    expect(tBefore - (await balTenant(tenantA))).toBe(5000000n);   // pool debited
    expect((await balUser(borrower)) - bBefore).toBe(5000000n);    // borrower funded
  });

  it('REPAYS in two parts → loan CLOSES; pool refunded (zero-sum); over-repay rejected', async () => {
    const tBefore = await balTenant(tenantA); const bBefore = await balUser(borrower);
    await loansSvc.repay(tenantA, borrowerActor, loanId, `idem-${randomUUID()}`, { amountMinor: '2000000', channel: 'wallet' } as any, null);
    const closed = await loansSvc.repay(tenantA, borrowerActor, loanId, `idem-${randomUUID()}`, { amountMinor: '3000000', channel: 'wallet' } as any, null);
    expect(closed.status).toBe('closed'); expect(closed.outstandingMinor).toBe('0');
    expect((await balTenant(tenantA)) - tBefore).toBe(5000000n);   // pool repaid in full
    expect(bBefore - (await balUser(borrower))).toBe(5000000n);    // borrower paid back
    await expect(loansSvc.repay(tenantA, borrowerActor, loanId, `idem-${randomUUID()}`, { amountMinor: '1', channel: 'wallet' } as any, null)).rejects.toThrow();
  });

  it('RLS: tenant B cannot see tenant A\'s loan', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM loans WHERE id=$1`, [loanId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM loans WHERE id=$1`, [loanId])).rows.length).toBe(1);
  });
});
