// modules/buyer/services/saved.service.ts · the buyer's saves + saved searches.
// Ownership is ALWAYS the caller's own userId (never a client id) → no IDOR. No money, no state machine —
// owner-scoped favourites. Add/remove are naturally idempotent (unique key / delete-if-exists), so no
// Idempotency-Key is required. Reads are keyset + owner-scoped.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { assertSavedEntityType } from '../domain/saved-item.entity';
import { SavedSearchNotFoundError } from '../domain/saved.errors';
import { SavedItemRepository } from '../repositories/saved-item.repository';
import { SavedSearchRepository } from '../repositories/saved-search.repository';

const encodeCursor = (createdAt: string, id: string) => Buffer.from(`${createdAt}|${id}`).toString('base64');
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Injectable()
export class SavedService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly items: SavedItemRepository,
    private readonly searches: SavedSearchRepository,
  ) {}

  // ---------- saved items ----------
  async save(tenantId: string, userId: string, entityType: string, entityId: string) {
    const t = assertSavedEntityType(entityType);                       // domain validates the catalogue
    await this.uow.run(tenantId, (tx) => this.items.insert(tx, tenantId, userId, t, entityId), { userId });
    return { ok: true };
  }
  async unsave(tenantId: string, userId: string, entityType: string, entityId: string) {
    const t = assertSavedEntityType(entityType);
    const n = await this.uow.run(tenantId, (tx) => this.items.remove(tx, userId, t, entityId), { userId });
    return { ok: true, removed: n > 0 };
  }
  async listItems(tenantId: string, userId: string, q: { entityType?: string; cursor?: string; limit?: number }) {
    const limit = q.limit ?? 50;
    const rows = await this.items.listForUser(tenantId, userId, { entityType: q.entityType, cursor: decodeCursor(q.cursor), limit });
    const last = rows[rows.length - 1];
    return { items: rows, nextCursor: rows.length === limit && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  // ---------- saved searches ----------
  async createSearch(tenantId: string, userId: string, name: string, query: Record<string, unknown>, notify: boolean) {
    const id = await this.uow.run(tenantId, (tx) => this.searches.insert(tx, tenantId, userId, name, query, notify), { userId });
    return { id };
  }
  async deleteSearch(tenantId: string, userId: string, id: string) {
    const n = await this.uow.run(tenantId, (tx) => this.searches.remove(tx, userId, id), { userId });
    if (n === 0) throw new SavedSearchNotFoundError(id);              // owner-scoped: not-yours == not-found (no enumeration)
    return { ok: true };
  }
  listSearches(tenantId: string, userId: string) { return this.searches.listForUser(tenantId, userId); }
}
