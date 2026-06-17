// core/wallet/reconciliation.service.ts
// Continuous money-safety checks over the ledger (run by the worker on a privileged connection —
// kv_wallet/kv_relay/admin — since wallet_accounts + ledger_* are outside tenant RLS). Each run is
// recorded in reconciliation_runs with any mismatches, so drift is detected automatically and
// audibly rather than discovered in an audit months later. Bounded by a time window (Law 5).
//   • zero_sum_check     — every ledger transaction's entries must sum to ZERO (double-entry);
//   • hourly_internal    — each account's cached_balance_minor must equal Σ of its entries.
// A NON-empty mismatch list is a sev-1 signal (money created/destroyed or a balance drifted).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../database/unit-of-work';

export interface ReconResult { runId: string; ok: boolean; checked: number; mismatches: unknown[]; }

@Injectable()
export class ReconciliationService {
  /** Verify every transaction in the window is balanced (Σ legs = 0). */
  async runZeroSumCheck(tx: TxContext, windowHours = 24): Promise<ReconResult> {
    const run = await this.openRun(tx, 'zero_sum_check', windowHours);
    const bad = await tx.query<{ txn_id: string; s: string }>(
      `SELECT txn_id, SUM(amount_minor)::text AS s FROM ledger_entries
        WHERE created_at >= now() - ($1 || ' hours')::interval
        GROUP BY txn_id HAVING SUM(amount_minor) <> 0 LIMIT 1000`, [String(windowHours)]);
    const checked = await tx.query<{ n: string }>(
      `SELECT count(DISTINCT txn_id)::text n FROM ledger_entries WHERE created_at >= now() - ($1 || ' hours')::interval`, [String(windowHours)]);
    const mismatches = bad.rows.map((r) => ({ txnId: r.txn_id, sumMinor: r.s }));
    return this.closeRun(tx, run, Number(checked.rows[0]?.n ?? 0), mismatches);
  }

  /** Verify each account's cached balance equals the sum of its ledger entries. */
  async runInternalBalanceCheck(tx: TxContext): Promise<ReconResult> {
    const run = await this.openRun(tx, 'hourly_internal', 0);
    const bad = await tx.query<{ id: string; cached: string; actual: string }>(
      `SELECT a.id, a.cached_balance_minor::text cached, COALESCE(SUM(e.amount_minor),0)::text actual
         FROM wallet_accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
        GROUP BY a.id, a.cached_balance_minor
        HAVING a.cached_balance_minor <> COALESCE(SUM(e.amount_minor),0) LIMIT 1000`);
    const checked = await tx.query<{ n: string }>(`SELECT count(*)::text n FROM wallet_accounts`);
    const mismatches = bad.rows.map((r) => ({ accountId: r.id, cachedMinor: r.cached, actualMinor: r.actual }));
    return this.closeRun(tx, run, Number(checked.rows[0]?.n ?? 0), mismatches);
  }

  private async openRun(tx: TxContext, runType: string, windowHours: number): Promise<string> {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO reconciliation_runs (run_type, period_start, period_end, status)
       VALUES ($1, now() - ($2 || ' hours')::interval, now(), 'running') RETURNING id`, [runType, String(windowHours)]);
    return r.rows[0].id;
  }
  private async closeRun(tx: TxContext, runId: string, checked: number, mismatches: unknown[]): Promise<ReconResult> {
    const ok = mismatches.length === 0;
    await tx.query(
      `UPDATE reconciliation_runs SET status=$2, checked_count=$3, mismatches=$4::jsonb, finished_at=now() WHERE id=$1`,
      [runId, ok ? 'ok' : 'mismatch', checked, JSON.stringify(mismatches)]);
    return { runId, ok, checked, mismatches };
  }
}
