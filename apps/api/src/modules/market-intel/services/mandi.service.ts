// modules/market-intel/services/mandi.service.ts · browse the global mandi registry (read-only).
import { Injectable } from '@nestjs/common';
import { MandiRepository } from '../repositories/mandi.repository';
import { MandiNotFoundError } from '../domain/market-intel.errors';

@Injectable()
export class MandiService {
  constructor(private readonly repo: MandiRepository) {}
  async getById(tenantId: string, id: string) { const m = await this.repo.getById(tenantId, id); if (!m) throw new MandiNotFoundError(id); return m.toJSON(); }
  async list(tenantId: string, q: { regionId?: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((m) => m.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
