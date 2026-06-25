// modules/payments/read-models/wallet-insights.read-model.ts
// CQRS reads for the wallet EARNINGS + SPENDING-INSIGHTS screens. Both aggregate the caller's OWN wallet ledger
// (joined to wallet_accounts owner_kind='user' AND owner_user_id = caller — anti-IDOR), served from the REPLICA
// (Law 12), and are FLOAT-FREE: every sum is a bigint computed in Postgres and returned as a string. Bounded by a
// resolved window (insights-window.ts) so a query never scans the whole ledger. Read-only — never writes (Law 2/11).
//   • earnings  = CREDITS (amount_minor > 0) to the user's account
//   • spending  = DEBITS  (amount_minor < 0), reported as positive magnitudes
import { Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { resolveWindow } from './insights-window';

export interface InsightBucket { key: string; amountMinor: string; count: number }
export interface InsightsView {
  fromIso: string; toIso: string; currencyCode: string;
  totalMinor: string;          // bigint as string (credited for earnings / spent for spending)
  byMonth: InsightBucket[];    // key = 'YYYY-MM'
  byType: InsightBucket[];     // key = ledger_txn_type code
}

@Injectable()
export class WalletInsightsReadModel {
  constructor(private readonly pools: PgPoolProvider) {}

  async earnings(viewerUserId: string, userId: string, canModerate: boolean, opts: { from?: string; to?: string; currencyCode?: string }): Promise<InsightsView> {
    return this.aggregate('credit', viewerUserId, userId, canModerate, opts);
  }
  async spending(viewerUserId: string, userId: string, canModerate: boolean, opts: { from?: string; to?: string; currencyCode?: string }): Promise<InsightsView> {
    return this.aggregate('debit', viewerUserId, userId, canModerate, opts);
  }

  private async aggregate(direction: 'credit' | 'debit', viewerUserId: string, userId: string, canModerate: boolean, opts: { from?: string; to?: string; currencyCode?: string }): Promise<InsightsView> {
    const currencyCode = opts.currencyCode ?? 'INR';
    const win = resolveWindow(opts.from, opts.to);
    if (viewerUserId !== userId && !canModerate) {
      return { ...win, currencyCode, totalMinor: '0', byMonth: [], byType: [] }; // fail closed (anti-IDOR)
    }
    // credits: amount_minor > 0 → SUM(amount_minor); debits: amount_minor < 0 → SUM(-amount_minor) (positive magnitude)
    const sign = direction === 'credit' ? 'e.amount_minor > 0' : 'e.amount_minor < 0';
    const magnitude = direction === 'credit' ? 'e.amount_minor' : '-e.amount_minor';
    const params = [userId, currencyCode, win.fromIso, win.toIso];
    const db = this.pools.replica(0);

    const baseFrom = `
       FROM ledger_entries e
       JOIN wallet_accounts a ON a.id = e.account_id AND a.owner_kind = 'user' AND a.owner_user_id = $1
       JOIN ledger_transactions t ON t.id = e.txn_id
       LEFT JOIN lookup_values lv ON lv.id = t.txn_type_id
      WHERE e.currency_code = $2 AND e.created_at >= $3 AND e.created_at < $4 AND ${sign}`;

    const [total, byMonth, byType] = await Promise.all([
      db.query<{ s: string }>(`SELECT COALESCE(SUM(${magnitude}),0)::text AS s ${baseFrom}`, params),
      db.query<{ k: string; s: string; n: string }>(
        `SELECT to_char(date_trunc('month', e.created_at), 'YYYY-MM') AS k, COALESCE(SUM(${magnitude}),0)::text AS s, count(*)::text AS n
         ${baseFrom} GROUP BY 1 ORDER BY 1 DESC LIMIT 36`, params),
      db.query<{ k: string; s: string; n: string }>(
        `SELECT COALESCE(lv.code, 'unknown') AS k, COALESCE(SUM(${magnitude}),0)::text AS s, count(*)::text AS n
         ${baseFrom} GROUP BY 1 ORDER BY SUM(${magnitude}) DESC LIMIT 30`, params),
    ]);

    const map = (rows: Array<{ k: string; s: string; n: string }>): InsightBucket[] =>
      rows.map((r) => ({ key: r.k, amountMinor: r.s, count: Number(r.n) }));
    return {
      fromIso: win.fromIso, toIso: win.toIso, currencyCode,
      totalMinor: total.rows[0]?.s ?? '0',
      byMonth: map(byMonth.rows),
      byType: map(byType.rows),
    };
  }
}
