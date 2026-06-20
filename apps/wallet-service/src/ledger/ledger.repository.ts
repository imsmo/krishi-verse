// apps/wallet-service/src/ledger/ledger.repository.ts · ALL ledger/wallet SQL for the standalone money service
// (the ONLY writer of wallet_accounts + ledger_*, Law 2). Mirrors apps/api/src/core/wallet/ledger.repository.ts
// (same tables, 0006_money.sql) and adds platform-account STRIPING: a platform leg targets a specific shard_no,
// and a platform balance sums all stripes. Accounts are locked FOR UPDATE before their balance changes. Money
// is bigint minor units end-to-end — never a JS number (Law 2). Parameterised SQL only.
import { Tx } from '../core/database/pg-pool.provider';

export interface LockedAccount { id: string; balanceMinor: bigint; lastHash: string | null; isFrozen: boolean; kind: string; }

export class LedgerRepository {
  async ensureUserAccountId(tx: Tx, userId: string, accountCode: string, currency: string): Promise<string> {
    await tx.query(
      `INSERT INTO wallet_accounts (owner_kind, owner_user_id, account_code, currency_code)
       VALUES ('user',$1,$2,$3) ON CONFLICT (owner_user_id, account_code, currency_code) WHERE owner_kind='user' DO NOTHING`,
      [userId, accountCode, currency]);
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM wallet_accounts WHERE owner_kind='user' AND owner_user_id=$1 AND account_code=$2 AND currency_code=$3`,
      [userId, accountCode, currency]);
    return r.rows[0].id;
  }
  async ensureTenantAccountId(tx: Tx, tenantId: string, accountCode: string, currency: string): Promise<string> {
    await tx.query(
      `INSERT INTO wallet_accounts (owner_kind, owner_tenant_id, account_code, currency_code)
       VALUES ('tenant',$1,$2,$3) ON CONFLICT (owner_tenant_id, account_code, currency_code) WHERE owner_kind='tenant' DO NOTHING`,
      [tenantId, accountCode, currency]);
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM wallet_accounts WHERE owner_kind='tenant' AND owner_tenant_id=$1 AND account_code=$2 AND currency_code=$3`,
      [tenantId, accountCode, currency]);
    return r.rows[0].id;
  }
  /** Platform account on a specific stripe (shard_no) — the hot-account striping target. */
  async ensurePlatformAccountId(tx: Tx, accountCode: string, currency: string, shardNo: number): Promise<string> {
    await tx.query(
      `INSERT INTO wallet_accounts (owner_kind, account_code, currency_code, shard_no)
       VALUES ('platform',$1,$2,$3) ON CONFLICT (account_code, currency_code, shard_no) WHERE owner_kind='platform' DO NOTHING`,
      [accountCode, currency, shardNo]);
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM wallet_accounts WHERE owner_kind='platform' AND account_code=$1 AND currency_code=$2 AND shard_no=$3`,
      [accountCode, currency, shardNo]);
    return r.rows[0].id;
  }

  async lockAccount(tx: Tx, id: string): Promise<LockedAccount> {
    const r = await tx.query<any>(
      `SELECT id, cached_balance_minor, last_entry_hash, is_frozen, owner_kind FROM wallet_accounts WHERE id=$1 FOR UPDATE`, [id]);
    const row = r.rows[0];
    return { id: row.id, balanceMinor: BigInt(row.cached_balance_minor), lastHash: row.last_entry_hash, isFrozen: row.is_frozen, kind: row.owner_kind };
  }

  /** Claim the idempotency key by inserting the txn header. Returns the existing id if replayed (Law 3). */
  async insertTxnIdempotent(tx: Tx, input: { txnTypeId: string; tenantId: string | null; idempotencyKey: string; referenceType?: string | null; referenceId?: string | null; initiatedBy?: string | null; description?: string | null }): Promise<{ id: string; replayed: boolean }> {
    const ins = await tx.query<{ id: string }>(
      `INSERT INTO ledger_transactions (txn_type_id, tenant_id, reference_type, reference_id, description, idempotency_key, initiated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [input.txnTypeId, input.tenantId, input.referenceType ?? null, input.referenceId ?? null, input.description ?? null, input.idempotencyKey, input.initiatedBy ?? null]);
    if (ins.rows[0]) return { id: ins.rows[0].id, replayed: false };
    const prior = await tx.query<{ id: string }>(`SELECT id FROM ledger_transactions WHERE idempotency_key=$1`, [input.idempotencyKey]);
    return { id: prior.rows[0].id, replayed: true };
  }

  /** Append one balanced, hash-chained entry and update the account's cached balance + version. */
  async appendEntry(tx: Tx, e: { txnId: string; accountId: string; tenantId: string | null; amountMinor: bigint; currencyCode: string; balanceAfter: bigint; prevHash: string | null; entryHash: string }): Promise<void> {
    await tx.query(
      `INSERT INTO ledger_entries (txn_id, account_id, tenant_id, amount_minor, currency_code, balance_after_minor, prev_hash, entry_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [e.txnId, e.accountId, e.tenantId, e.amountMinor.toString(), e.currencyCode, e.balanceAfter.toString(), e.prevHash, e.entryHash]);
    await tx.query(
      `UPDATE wallet_accounts SET cached_balance_minor=$2, balance_version=balance_version+1, last_entry_hash=$3, updated_at=now() WHERE id=$1`,
      [e.accountId, e.balanceAfter.toString(), e.entryHash]);
  }

  async balanceOf(tx: Tx, id: string): Promise<bigint> {
    const r = await tx.query<{ cached_balance_minor: string }>(`SELECT cached_balance_minor FROM wallet_accounts WHERE id=$1`, [id]);
    return r.rows[0] ? BigInt(r.rows[0].cached_balance_minor) : 0n;
  }
  /** Summed balance across all stripes of a platform account. */
  async platformBalance(tx: Tx, accountCode: string, currency: string): Promise<bigint> {
    const r = await tx.query<{ s: string }>(
      `SELECT COALESCE(SUM(cached_balance_minor),0)::text s FROM wallet_accounts WHERE owner_kind='platform' AND account_code=$1 AND currency_code=$2`, [accountCode, currency]);
    return BigInt(r.rows[0]?.s ?? '0');
  }

  async setFrozen(tx: Tx, id: string, frozen: boolean): Promise<void> {
    await tx.query(`UPDATE wallet_accounts SET is_frozen=$2, updated_at=now() WHERE id=$1`, [id, frozen]);
  }
}
