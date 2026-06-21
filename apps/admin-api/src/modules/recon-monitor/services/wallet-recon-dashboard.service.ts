// apps/admin-api/src/modules/recon-monitor/services/wallet-recon-dashboard.service.ts · READ-ONLY money-safety
// dashboard. Surfaces: the latest reconciliation_run per type (status + mismatch count), the platform ledger
// zero-sum health (SUM of all entries must be 0 — the double-entry invariant), a keyset list of recent runs,
// and a single run's detail with its mismatches. All money as STRING minor units (Law 2). No writes; the access
// interceptor audits every read.
import { Injectable } from '@nestjs/common';
import { ReconRepository, RunListQuery } from '../repositories/recon.repository';
import { ReconRunNotFoundError, WalletAccountNotFoundError } from '../domain/recon-monitor.errors';

@Injectable()
export class WalletReconDashboardService {
  constructor(private readonly repo: ReconRepository) {}

  async overview() {
    const [latest, zeroSum] = await Promise.all([this.repo.latestByType(), this.repo.ledgerZeroSum()]);
    return { latestByType: latest, ledgerZeroSum: zeroSum };   // zeroSum.balanced=false ⇒ money-safety alarm
  }

  async listRuns(q: RunListQuery) {
    const rows = await this.repo.listRuns(q);
    const last = rows[rows.length - 1] as any;
    const nextCursor = rows.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items: rows, nextCursor };
  }

  async getRun(id: string) {
    const run = await this.repo.getRun(id);
    if (!run) throw new ReconRunNotFoundError(id);
    return run;
  }

  async getAccount(id: string) {
    const acct = await this.repo.getAccount(id);
    if (!acct) throw new WalletAccountNotFoundError(id);
    return acct;
  }
}
