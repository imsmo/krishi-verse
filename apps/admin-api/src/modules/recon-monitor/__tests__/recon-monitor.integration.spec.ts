// apps/admin-api/src/modules/recon-monitor/__tests__/recon-monitor.integration.spec.ts
// REAL end-to-end proof against a live Postgres (schema apps/api builds + migrations 0006 money + 0033). Proves:
// open an investigation on a seeded reconciliation_run (+ audit row + the one-open-per-run dedup), and freeze →
// unfreeze a seeded wallet account (asserting wallet_accounts.is_frozen flips, an account_freeze_orders history
// row is written, audit rows exist, AND no ledger_entries were created — money never moves). Runs only when
// DATABASE_ADMIN_URL/DATABASE_URL is set (CI's DB job).
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { ReconRepository } from '../repositories/recon.repository';
import { MismatchInvestigationsService } from '../services/mismatch-investigations.service';
import { LedgerFreezeControlsService } from '../services/ledger-freeze-controls.service';
import { DuplicateInvestigationError } from '../domain/recon-monitor.errors';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

run('recon-monitor (integration, real Postgres — money-safety ops + audit)', () => {
  let pool: AdminPool; let inspect: Pool;
  let investigations: MismatchInvestigationsService; let freeze: LedgerFreezeControlsService;
  const actor = { userId: randomUUID(), roles: ['platform_recon_ops'], amr: ['hwk'], authTimeSec: Math.floor(Date.now() / 1000), sessionId: '', permissions: new Set(['recon.manage']), ip: '10.0.0.1', requestId: 'itest' } as any;
  let runId = ''; let accountId = '';

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    const audit = new AdminAuditWriter(pool);
    const repo = new ReconRepository(pool);
    investigations = new MismatchInvestigationsService(pool, audit, repo);
    freeze = new LedgerFreezeControlsService(pool, audit, repo);
    inspect = new Pool({ connectionString: APP_URL });
    const r = await inspect.query(
      `INSERT INTO reconciliation_runs (run_type, period_start, period_end, status, checked_count, mismatches)
       VALUES ('zero_sum_check', now()-interval '1 hour', now(), 'completed', 10, '[{"account":"escrow","delta":"100"}]'::jsonb) RETURNING id`);
    runId = r.rows[0].id;
    const a = await inspect.query(`INSERT INTO wallet_accounts (owner_kind, account_code, currency_code) VALUES ('platform','suspense','INR') RETURNING id`);
    accountId = a.rows[0].id;
  }, 30000);

  afterAll(async () => {
    if (inspect) {
      await inspect.query(`DELETE FROM account_freeze_orders WHERE account_id=$1`, [accountId]).catch(() => undefined);
      await inspect.query(`DELETE FROM wallet_accounts WHERE id=$1`, [accountId]).catch(() => undefined);
      await inspect.query(`DELETE FROM recon_investigations WHERE run_id=$1`, [runId]).catch(() => undefined);
      await inspect.query(`DELETE FROM reconciliation_runs WHERE id=$1`, [runId]).catch(() => undefined);
      await inspect.end();
    }
    await pool?.onModuleDestroy();
  });

  it('opens an investigation on a run + audits + dedups (one open per run)', async () => {
    const out: any = await investigations.open(actor, { runId, severity: 'critical', summary: 'escrow delta 100 paise' });
    expect(out.status).toBe('open');
    const au = await inspect.query(`SELECT 1 FROM audit_log WHERE entity_id=$1 AND action='recon.investigation_opened'`, [out.id]);
    expect(au.rows.length).toBe(1);
    await expect(investigations.open(actor, { runId, severity: 'high', summary: 'dup attempt' })).rejects.toBeInstanceOf(DuplicateInvestigationError);
  });

  it('freeze → unfreeze flips is_frozen, writes freeze-orders + audit, posts NO ledger entry', async () => {
    const before = await inspect.query(`SELECT count(*)::int AS c FROM ledger_entries`);
    await freeze.setFreeze(actor, accountId, { action: 'freeze', reason: 'recon mismatch — precautionary' });
    let acct = await inspect.query(`SELECT is_frozen, freeze_reason FROM wallet_accounts WHERE id=$1`, [accountId]);
    expect(acct.rows[0].is_frozen).toBe(true);
    expect(acct.rows[0].freeze_reason).toContain('precautionary');

    await freeze.setFreeze(actor, accountId, { action: 'unfreeze', reason: 'cleared by investigation' });
    acct = await inspect.query(`SELECT is_frozen FROM wallet_accounts WHERE id=$1`, [accountId]);
    expect(acct.rows[0].is_frozen).toBe(false);

    const orders = await inspect.query(`SELECT action FROM account_freeze_orders WHERE account_id=$1 ORDER BY created_at`, [accountId]);
    expect(orders.rows.map((x: any) => x.action)).toEqual(['freeze', 'unfreeze']);
    const audits = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action IN ('wallet.account_frozen','wallet.account_unfrozen')`, [accountId]);
    expect(audits.rows[0].c).toBe(2);
    const after = await inspect.query(`SELECT count(*)::int AS c FROM ledger_entries`);
    expect(after.rows[0].c).toBe(before.rows[0].c);   // money NEVER moved — zero new ledger entries
  });
});
