// modules/payments/read-models/wallet-ledger.read-model.ts
// CQRS read of a user's wallet LEDGER (the per-entry statement the wallet/transactions screen shows). Served from
// the REPLICA, never the primary (Law 12). The double-entry ledger (ledger_entries + ledger_transactions) is the
// wallet-service's domain and lives outside tenant RLS, so we scope EXPLICITLY by joining ledger_entries to the
// caller's own wallet_accounts (owner_kind='user' AND owner_user_id = caller) — a user can only ever see entries
// that touched their own account (anti-IDOR). Amounts are signed bigint minor units returned as strings
// (bigint-safe). Keyset pagination on (created_at DESC, id DESC); never OFFSET. Read-only projection — this NEVER
// writes the ledger (Law 2/11).
import { Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';

export interface WalletLedgerEntryView {
  entryId: string;            // bigint id as string (keyset cursor component)
  txnId: string;
  txnType: string | null;     // lookup_values code under 'ledger_txn_type' (e.g. 'order_payment')
  accountCode: string;        // 'main' | 'hold'
  amountMinor: string;        // SIGNED: +credit / −debit
  balanceAfterMinor: string;  // running balance of that account after this entry
  currencyCode: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;          // ISO
}

export interface WalletLedgerCursor { c: string; id: string; }
export interface WalletLedgerPage { items: WalletLedgerEntryView[]; nextCursor: string | null; }

/** Encode/decode the keyset cursor as base64("<createdAtIso>|<entryId>") — mirrors the payments controller scheme. */
export function encodeLedgerCursor(createdAtIso: string, entryId: string): string {
  return Buffer.from(`${createdAtIso}|${entryId}`).toString('base64');
}

@Injectable()
export class WalletLedgerReadModel {
  constructor(private readonly pools: PgPoolProvider) {}

  /** The caller's own ledger. `viewerUserId` MUST equal `userId` unless `canModerate` (finance/support) — anti-IDOR. */
  async forUser(
    viewerUserId: string,
    userId: string,
    canModerate: boolean,
    opts: { cursor?: WalletLedgerCursor; limit: number; currencyCode?: string },
  ): Promise<WalletLedgerPage> {
    if (viewerUserId !== userId && !canModerate) {
      return { items: [], nextCursor: null }; // fail closed: never leak another user's ledger
    }
    const currencyCode = opts.currencyCode ?? 'INR';
    const params: unknown[] = [userId, currencyCode];
    let keyset = '';
    if (opts.cursor) {
      params.push(opts.cursor.c, opts.cursor.id);
      keyset = `AND (e.created_at < $3 OR (e.created_at = $3 AND e.id < $4::bigint))`;
    }
    params.push(opts.limit);
    const limIdx = params.length;
    const r = await this.pools.replica(0).query<{
      entry_id: string; txn_id: string; txn_type: string | null; account_code: string;
      amount_minor: string; balance_after_minor: string; currency_code: string;
      reference_type: string | null; reference_id: string | null; description: string | null; created_at: Date;
    }>(
      `SELECT e.id::text AS entry_id, e.txn_id::text AS txn_id, lv.code AS txn_type, a.account_code,
              e.amount_minor::text AS amount_minor, e.balance_after_minor::text AS balance_after_minor,
              e.currency_code, t.reference_type, t.reference_id::text AS reference_id, t.description, e.created_at
         FROM ledger_entries e
         JOIN wallet_accounts a
           ON a.id = e.account_id AND a.owner_kind = 'user' AND a.owner_user_id = $1
         JOIN ledger_transactions t ON t.id = e.txn_id
         LEFT JOIN lookup_values lv ON lv.id = t.txn_type_id
        WHERE e.currency_code = $2 ${keyset}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT $${limIdx}`,
      params);

    const items: WalletLedgerEntryView[] = r.rows.map((x) => ({
      entryId: x.entry_id,
      txnId: x.txn_id,
      txnType: x.txn_type,
      accountCode: x.account_code,
      amountMinor: x.amount_minor,
      balanceAfterMinor: x.balance_after_minor,
      currencyCode: x.currency_code,
      referenceType: x.reference_type,
      referenceId: x.reference_id,
      description: x.description,
      createdAt: x.created_at instanceof Date ? x.created_at.toISOString() : String(x.created_at),
    }));

    const last = items.length === opts.limit ? items[items.length - 1] : undefined;
    const nextCursor = last ? encodeLedgerCursor(last.createdAt, last.entryId) : null;
    return { items, nextCursor };
  }
}
