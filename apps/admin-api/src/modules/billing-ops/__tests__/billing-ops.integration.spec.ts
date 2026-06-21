// apps/admin-api/src/modules/billing-ops/__tests__/billing-ops.integration.spec.ts
// REAL end-to-end proof against a live Postgres (the schema apps/api builds + migrations 0002/0035). Proves:
// work a SaaS invoice draft→issued→overdue + record a dunning attempt (counter bumps, audit rows), and apply a
// manual billing adjustment (billing_adjustments row written + audit + idempotent replay). The wallet-service is
// the money writer in production; here a fake WalletAdminPort stands in for it (the gRPC server isn't booted in
// this suite) so we exercise the admin-side record/audit/idempotency. Runs only when DATABASE_ADMIN_URL is set.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { BillingRepository } from '../repositories/billing.repository';
import { SaasInvoicesAdminService } from '../services/saas-invoices-admin.service';
import { DunningService } from '../services/dunning.service';
import { ManualAdjustmentService } from '../services/manual-adjustment.service';
import { WalletAdminPort, PostAdjustmentInput } from '../../../core/wallet/wallet-admin.port';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

// Fake wallet-service: records calls, returns a fabricated txn id; idempotent on key (mirrors the real engine).
class FakeWallet implements WalletAdminPort {
  calls: PostAdjustmentInput[] = [];
  private byKey = new Map<string, string>();
  async post(input: PostAdjustmentInput) {
    this.calls.push(input);
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) return { txnId: existing, alreadyApplied: true };
    const txnId = randomUUID(); this.byKey.set(input.idempotencyKey, txnId);
    return { txnId, alreadyApplied: false };
  }
}

run('billing-ops (integration, real Postgres — invoices + dunning + adjustments)', () => {
  let pool: AdminPool; let inspect: Pool;
  let invoiceSvc: SaasInvoicesAdminService; let dunningSvc: DunningService; let adjustSvc: ManualAdjustmentService; let wallet: FakeWallet;
  const actor = { userId: randomUUID(), roles: ['platform_billing_ops'], amr: ['hwk'], authTimeSec: Math.floor(Date.now() / 1000), sessionId: '', permissions: new Set(['billing.manage']), ip: '10.0.0.1', requestId: 'itest' } as any;
  let tenantId = ''; let invoiceId = '';

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    const audit = new AdminAuditWriter(pool);
    const repo = new BillingRepository(pool);
    wallet = new FakeWallet();
    invoiceSvc = new SaasInvoicesAdminService(pool, audit, repo);
    dunningSvc = new DunningService(pool, audit, repo);
    adjustSvc = new ManualAdjustmentService(pool, audit, repo, wallet);
    inspect = new Pool({ connectionString: APP_URL });
    const t = await inspect.query(`SELECT id FROM tenants LIMIT 1`);
    tenantId = t.rows[0].id;
    const inv = await inspect.query(
      `INSERT INTO saas_invoices (tenant_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor, due_date, line_items)
       VALUES ($1,$2,'draft','INR',100000,18000,118000, CURRENT_DATE - 1, '[]'::jsonb) RETURNING id`,
      [tenantId, `KV-ITEST-${Date.now()}`]);
    invoiceId = inv.rows[0].id;
  }, 30000);

  afterAll(async () => {
    if (inspect) {
      await inspect.query(`DELETE FROM saas_invoice_dunning_attempts WHERE invoice_id=$1`, [invoiceId]).catch(() => undefined);
      await inspect.query(`DELETE FROM billing_adjustments WHERE tenant_id=$1 AND reason='itest goodwill'`, [tenantId]).catch(() => undefined);
      await inspect.query(`DELETE FROM saas_invoices WHERE id=$1`, [invoiceId]).catch(() => undefined);
      await inspect.end();
    }
    await pool?.onModuleDestroy();
  });

  it('invoice: draft→issued→overdue + a dunning attempt (counter + audit)', async () => {
    await invoiceSvc.update(actor, invoiceId, { action: 'issue', reason: 'cycle billing' });
    await invoiceSvc.update(actor, invoiceId, { action: 'mark_overdue', reason: 'past due date' });
    const out: any = await dunningSvc.record(actor, invoiceId, { channel: 'email', outcome: 'sent', note: 'first reminder' });
    expect(out.attemptNo).toBe(1);
    const row = await inspect.query(`SELECT status, dunning_attempts FROM saas_invoices WHERE id=$1`, [invoiceId]);
    expect(row.rows[0].status).toBe('overdue');
    expect(row.rows[0].dunning_attempts).toBe(1);
    const au = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action IN ('billing.invoice_issued','billing.invoice_overdue','billing.invoice_dunned')`, [invoiceId]);
    expect(au.rows[0].c).toBe(3);
  });

  it('adjustment: applies via the wallet port, records + audits, and is idempotent on replay', async () => {
    const dto = { tenantId, direction: 'credit' as const, amountMinor: '50000', currency: 'INR', reason: 'itest goodwill', idempotencyKey: `itest-${Date.now()}` };
    const first: any = await adjustSvc.apply(actor, dto);
    expect(first.walletTxnId).toBeTruthy();
    expect(first.amountMinor).toBe('50000');
    const second: any = await adjustSvc.apply(actor, dto);     // replay — same key
    expect(second.id).toBe(first.id);
    expect(wallet.calls.length).toBe(1);                       // wallet hit exactly once (idempotent)
    const row = await inspect.query(`SELECT direction, amount_minor, wallet_txn_id FROM billing_adjustments WHERE id=$1`, [first.id]);
    expect(row.rows[0].direction).toBe('credit');
    expect(String(row.rows[0].amount_minor)).toBe('50000');
    const au = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action='billing.adjustment_applied'`, [first.id]);
    expect(au.rows[0].c).toBe(1);
  });
});
