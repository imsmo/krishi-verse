// apps/admin-api/src/modules/recon-monitor/repositories/recon.repository.ts · ALL SQL for the god-mode money-
// safety plane. READS: reconciliation_runs (latest-by-type, keyset list, single run) + a wallet zero-sum/health
// rollup + a single wallet account. WRITES (in the caller's tx): recon_investigations CRUD + the freeze CONTROL
// (lock wallet_accounts FOR UPDATE → flip is_frozen + freeze_reason → append an account_freeze_orders row). It
// NEVER touches ledger_entries/ledger_transactions — money moves only via the wallet-service (Law 2/9). Money is
// bigint, surfaced as STRING minor units (never floated). Parameterised only; keyset (never OFFSET); bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { Investigation, InvestigationProps } from '../domain/investigation.entity';
import { InvestigationStatus } from '../domain/investigation.state';
import { DuplicateInvestigationError } from '../domain/recon-monitor.errors';

function toInvestigation(r: any): Investigation {
  return Investigation.rehydrate({
    id: r.id, runId: r.run_id, status: r.status as InvestigationStatus, severity: r.severity, summary: r.summary,
    assignedTo: r.assigned_to ?? null, resolutionNote: r.resolution_note ?? null, openedBy: r.opened_by,
    resolvedAt: r.resolved_at ?? null, createdAt: r.created_at ?? null,
  });
}

export interface RunListQuery { runType?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }
export interface InvestigationListQuery { status?: InvestigationStatus; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ReconRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ---------------- reconciliation_runs (read-only) ---------------- */
  async latestByType(): Promise<{ runType: string; status: string; checkedCount: number; mismatchCount: number; finishedAt: string | null }[]> {
    const r = await this.pool.query(
      `SELECT DISTINCT ON (run_type) run_type, status, checked_count,
              jsonb_array_length(COALESCE(mismatches,'[]'::jsonb)) AS mismatch_count, finished_at
         FROM reconciliation_runs ORDER BY run_type, created_at DESC`);
    return r.rows.map((x: any) => ({ runType: x.run_type, status: x.status, checkedCount: x.checked_count ?? 0, mismatchCount: x.mismatch_count ?? 0, finishedAt: x.finished_at ?? null }));
  }

  async listRuns(q: RunListQuery): Promise<any[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = '1=1';
    if (q.runType) where += ` AND run_type=${p(q.runType)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, run_type, status, checked_count, jsonb_array_length(COALESCE(mismatches,'[]'::jsonb)) AS mismatch_count,
              period_start, period_end, finished_at, created_at
         FROM reconciliation_runs WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, runType: x.run_type, status: x.status, checkedCount: x.checked_count ?? 0, mismatchCount: x.mismatch_count ?? 0, periodStart: x.period_start, periodEnd: x.period_end, finishedAt: x.finished_at, createdAt: x.created_at }));
  }

  async getRun(id: string): Promise<any | null> {
    const r = await this.pool.query(
      `SELECT id, run_type, status, checked_count, mismatches, period_start, period_end, finished_at, created_at
         FROM reconciliation_runs WHERE id=$1`, [id]);
    if (!r.rows[0]) return null;
    const x = r.rows[0];
    return { id: x.id, runType: x.run_type, status: x.status, checkedCount: x.checked_count ?? 0, mismatches: x.mismatches ?? [], periodStart: x.period_start, periodEnd: x.period_end, finishedAt: x.finished_at, createdAt: x.created_at };
  }

  /** Platform zero-sum health: the ledger is double-entry, so SUM(all entries) must be 0. Reported as STRING. */
  async ledgerZeroSum(): Promise<{ sumMinor: string; balanced: boolean }> {
    const r = await this.pool.query(`SELECT COALESCE(SUM(amount_minor),0)::text AS s FROM ledger_entries`);
    const s = String(r.rows[0]?.s ?? '0');
    return { sumMinor: s, balanced: s === '0' };
  }

  /* ---------------- wallet account (read + freeze control) ---------------- */
  async getAccountForUpdate(client: PoolClient, id: string): Promise<{ id: string; ownerKind: string; accountCode: string; isFrozen: boolean } | null> {
    const r = await client.query(`SELECT id, owner_kind, account_code, is_frozen FROM wallet_accounts WHERE id=$1 FOR UPDATE`, [id]);
    const x = r.rows[0];
    return x ? { id: x.id, ownerKind: x.owner_kind, accountCode: x.account_code, isFrozen: x.is_frozen } : null;
  }

  async getAccount(id: string): Promise<any | null> {
    const r = await this.pool.query(
      `SELECT id, owner_kind, account_code, currency_code, cached_balance_minor::text AS balance, is_frozen, freeze_reason, shard_no
         FROM wallet_accounts WHERE id=$1`, [id]);
    const x = r.rows[0];
    return x ? { id: x.id, ownerKind: x.owner_kind, accountCode: x.account_code, currency: x.currency_code, balanceMinor: String(x.balance), isFrozen: x.is_frozen, freezeReason: x.freeze_reason ?? null, shardNo: x.shard_no } : null;
  }

  /** Flip the freeze guard + append the freeze-order history row, in the caller's tx. NO ledger write. */
  async setFrozen(client: PoolClient, accountId: string, frozen: boolean, reason: string, actorUserId: string): Promise<void> {
    await client.query(`UPDATE wallet_accounts SET is_frozen=$2, freeze_reason=$3, updated_by=$4, updated_at=now() WHERE id=$1`, [accountId, frozen, frozen ? reason : null, actorUserId]);
    await client.query(`INSERT INTO account_freeze_orders (account_id, action, reason, actor_user_id) VALUES ($1,$2,$3,$4)`, [accountId, frozen ? 'freeze' : 'unfreeze', reason, actorUserId]);
  }

  /* ---------------- recon_investigations CRUD ---------------- */
  async insertInvestigation(client: PoolClient, inv: Investigation, actorUserId: string): Promise<void> {
    const p = (inv as any).toJSON ? inv.toJSON() : (inv as unknown as InvestigationProps);
    try {
      await client.query(
        `INSERT INTO recon_investigations (id, run_id, status, severity, summary, assigned_to, opened_by, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.id, p.runId, p.status, p.severity, p.summary, p.assignedTo, p.openedBy, actorUserId]);
    } catch (e: any) {
      if (e?.code === '23505') throw new DuplicateInvestigationError(String(p.runId));   // one open investigation per run
      throw e;
    }
  }
  async getInvestigationForUpdate(client: PoolClient, id: string): Promise<Investigation | null> {
    const r = await client.query(`SELECT * FROM recon_investigations WHERE id=$1 FOR UPDATE`, [id]);
    return r.rows[0] ? toInvestigation(r.rows[0]) : null;
  }
  async updateInvestigation(client: PoolClient, inv: Investigation, actorUserId: string): Promise<void> {
    const p = inv.toJSON();
    await client.query(
      `UPDATE recon_investigations SET status=$2, assigned_to=$3, resolution_note=$4, resolved_at=$5, updated_by=$6, updated_at=now() WHERE id=$1`,
      [p.id, p.status, p.assignedTo, p.resolutionNote, p.resolvedAt, actorUserId]);
  }
  async getInvestigation(id: string): Promise<Investigation | null> {
    const r = await this.pool.query(`SELECT * FROM recon_investigations WHERE id=$1`, [id]);
    return r.rows[0] ? toInvestigation(r.rows[0]) : null;
  }
  async runExists(id: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM reconciliation_runs WHERE id=$1`, [id]);
    return (r.rowCount ?? 0) > 0;
  }
  async listInvestigations(q: InvestigationListQuery): Promise<Investigation[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = '1=1';
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT * FROM recon_investigations WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toInvestigation);
  }
}
