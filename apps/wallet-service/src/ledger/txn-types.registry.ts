// apps/wallet-service/src/ledger/txn-types.registry.ts · resolves a ledger_txn_type code → its lookup_values id
// (platform vocabulary, tenant_id NULL). Cached in-process (the set is small + slow-changing) so the hot money
// path doesn't re-query per post; a miss falls through to the DB once. Read-only.
import { Tx } from '../core/database/pg-pool.provider';

export class TxnTypeRegistry {
  private readonly cache = new Map<string, string>();
  async resolve(tx: Tx, code: string): Promise<string | null> {
    const hit = this.cache.get(code);
    if (hit) return hit;
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM lookup_values WHERE type_code='ledger_txn_type' AND tenant_id IS NULL AND code=$1 AND is_active=true`, [code]);
    const id = r.rows[0]?.id ?? null;
    if (id) this.cache.set(code, id);
    return id;
  }
}
