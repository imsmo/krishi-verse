// modules/buyer/repositories/saved-item.repository.ts · the buyer's favourites (saved_items, 0015 — RLS in 0020).
// ALWAYS filtered by the caller's own user_id (owner-scoped, no IDOR). Reads on the replica + keyset
// (created_at DESC, id DESC); writes take the UoW tx. Add is idempotent on the (user, type, id) unique key.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export interface SavedItemRow { id: string; entity_type: string; entity_id: string; created_at: Date; }
export interface SavedItem { id: string; entityType: string; entityId: string; createdAt: string; }

@Injectable()
export class SavedItemRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Idempotent save (re-saving the same item is a no-op, not an error). */
  async insert(tx: TxContext, tenantId: string, userId: string, entityType: string, entityId: string): Promise<void> {
    await tx.query(
      `INSERT INTO saved_items (tenant_id, user_id, entity_type, entity_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING`,
      [tenantId, userId, entityType, entityId]);
  }

  /** Un-save (owner-scoped). Returns rows affected (0 = nothing to remove). */
  async remove(tx: TxContext, userId: string, entityType: string, entityId: string): Promise<number> {
    const r = await tx.query(`DELETE FROM saved_items WHERE user_id=$1 AND entity_type=$2 AND entity_id=$3`, [userId, entityType, entityId]);
    return r.rowCount ?? 0;
  }

  /** The caller's saves (optionally one entity_type), keyset-paginated. Owner-scoped — never another user's. */
  async listForUser(tenantId: string, userId: string, q: { entityType?: string; cursor?: { c: string; id: string }; limit: number }): Promise<SavedItem[]> {
    const params: unknown[] = [userId];
    let where = `user_id=$1`;
    if (q.entityType) { params.push(q.entityType); where += ` AND entity_type=$${params.length}`; }
    if (q.cursor) { params.push(q.cursor.c, q.cursor.id); where += ` AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`; }
    params.push(q.limit);
    const r = await this.replica.forTenant(tenantId).query<SavedItemRow>(
      `SELECT id, entity_type, entity_id, created_at FROM saved_items
        WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`, params);
    return r.rows.map((x) => ({ id: x.id, entityType: x.entity_type, entityId: x.entity_id, createdAt: x.created_at.toISOString() }));
  }
}
