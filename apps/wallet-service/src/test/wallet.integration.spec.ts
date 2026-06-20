// apps/wallet-service/src/test/wallet.integration.spec.ts
// REAL proof against a live Postgres (db/migrations 0006 money tables): the standalone engine posts a balanced
// double-entry transaction, is idempotent on replay, stripes platform accounts (balance summed across stripes),
// and the reconciliation checks pass (every txn sums to zero; cached balances match entry sums). Uses
// platform-only legs (gateway→escrow) so no users/tenants FK setup is needed. wallet_accounts + ledger_* are
// intentionally OUTSIDE tenant RLS (platform-internal, kv_wallet-only) — so the cross-tenant-RLS gate does not
// apply here; the money invariant (Σ entries = 0) is asserted directly instead. Runs when DATABASE_URL is set.
import { randomUUID } from 'node:crypto';
import { buildWalletService, WalletService } from '../wallet.module';

const URL = process.env.DATABASE_WALLET_URL ?? process.env.DATABASE_URL;
const run = URL ? describe : describe.skip;

run('wallet-service ledger (integration, real Postgres)', () => {
  let svc: WalletService;
  const gateway = { kind: 'platform' as const, accountCode: 'gateway', currencyCode: 'INR' };
  const escrow = { kind: 'platform' as const, accountCode: 'escrow', currencyCode: 'INR' };
  const idem = `itest-${randomUUID()}`;
  const txnIds: string[] = [];

  beforeAll(() => { svc = buildWalletService({ NODE_ENV: 'test', DATABASE_WALLET_URL: URL }); });
  afterAll(async () => { await svc.pool.end(); });

  it('posts a balanced platform transfer (gateway → escrow)', async () => {
    const escrowBefore = await svc.balances.balanceMinor(escrow);
    const gatewayBefore = await svc.balances.balanceMinor(gateway);
    const res = await svc.pool.withTx((tx) => svc.engine.post(tx, {
      tenantId: null, txnType: 'order_payment', idempotencyKey: idem,
      legs: [{ account: gateway, amountMinor: -50000n }, { account: escrow, amountMinor: 50000n }],
      referenceType: 'itest', referenceId: null, initiatedBy: null, description: 'integration',
    }));
    expect(res.alreadyApplied).toBe(false);
    txnIds.push(res.txnId);
    expect(await svc.balances.balanceMinor(escrow) - escrowBefore).toBe(50000n);
    expect(await svc.balances.balanceMinor(gateway) - gatewayBefore).toBe(-50000n);
  });

  it('is idempotent: replaying the same key posts nothing new', async () => {
    const escrowBefore = await svc.balances.balanceMinor(escrow);
    const res = await svc.pool.withTx((tx) => svc.engine.post(tx, {
      tenantId: null, txnType: 'order_payment', idempotencyKey: idem,
      legs: [{ account: gateway, amountMinor: -50000n }, { account: escrow, amountMinor: 50000n }],
    }));
    expect(res.alreadyApplied).toBe(true);
    expect(res.txnId).toBe(txnIds[0]);
    expect(await svc.balances.balanceMinor(escrow)).toBe(escrowBefore);   // unchanged
  });

  it('the posted transaction sums to ZERO at the DB (double-entry invariant)', async () => {
    const r = await svc.pool.query<{ s: string }>(`SELECT COALESCE(SUM(amount_minor),0)::text s FROM ledger_entries WHERE txn_id=$1`, [txnIds[0]]);
    expect(r.rows[0].s).toBe('0');
  });

  it('reconciliation passes: zero-sum + internal-balance', async () => {
    const zero = await svc.pool.withTx((tx) => svc.reconciliation.runZeroSumCheck(tx, 1));
    expect(zero.ok).toBe(true);
    const internal = await svc.pool.withTx((tx) => svc.reconciliation.runInternalBalanceCheck(tx));
    expect(internal.ok).toBe(true);
  });
});
