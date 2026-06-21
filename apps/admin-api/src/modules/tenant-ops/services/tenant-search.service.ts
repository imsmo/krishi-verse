// apps/admin-api/src/modules/tenant-ops/services/tenant-search.service.ts · platform-wide tenant search/list
// (read-only). Keyset pagination (never OFFSET), bounded LIMIT. Returns a base64 cursor for the next page,
// mirroring ai-models-ops. The god-mode plane reads across all tenants by design (Law 11) — every access is
// audited by the interceptor.
import { Injectable } from '@nestjs/common';
import { TenantRepository, TenantSearchQuery } from '../repositories/tenant.repository';

@Injectable()
export class TenantSearchService {
  constructor(private readonly repo: TenantRepository) {}

  async search(q: TenantSearchQuery) {
    const rows = await this.repo.search(q);
    const items = rows.map((t) => t.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt ?? ''}|${last.id}`).toString('base64')
      : null;
    return { items, nextCursor };
  }
}
