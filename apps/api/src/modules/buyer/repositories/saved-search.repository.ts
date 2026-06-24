// modules/buyer/repositories/saved-search.repository.ts · the buyer's saved searches (saved_searches, 0015 — RLS 0020).
// Owner-scoped (user_id always the caller's). The `query` jsonb is stored verbatim so the saved list can re-run it.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

export interface SavedSearchRow { id: string; default_name: string; query: any; notify_new_matches: boolean; created_at: Date; }
export interface SavedSearch { id: string; name: string; query: Record<string, unknown>; notifyNewMatches: boolean; createdAt: string; }

@Injectable()
export class SavedSearchRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, tenantId: string, userId: string, name: string, query: Record<string, unknown>, notify: boolean): Promise<string> {
    const id = uuidv7();
    await tx.query(
      `INSERT INTO saved_searches (id, tenant_id, user_id, default_name, query, notify_new_matches)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [id, tenantId, userId, name, JSON.stringify(query), notify]);
    return id;
  }

  /** Delete the caller's OWN saved search (owner-scoped). Returns rows affected. */
  async remove(tx: TxContext, userId: string, id: string): Promise<number> {
    const r = await tx.query(`DELETE FROM saved_searches WHERE id=$1 AND user_id=$2`, [id, userId]);
    return r.rowCount ?? 0;
  }

  async listForUser(tenantId: string, userId: string): Promise<SavedSearch[]> {
    const r = await this.replica.forTenant(tenantId).query<SavedSearchRow>(
      `SELECT id, default_name, query, notify_new_matches, created_at FROM saved_searches
        WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 200`, [userId]);
    return r.rows.map((x) => ({ id: x.id, name: x.default_name, query: x.query ?? {}, notifyNewMatches: x.notify_new_matches, createdAt: x.created_at.toISOString() }));
  }
}
