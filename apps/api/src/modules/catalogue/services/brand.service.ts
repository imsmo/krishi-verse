// modules/catalogue/services/brand.service.ts · READ use-case: browse global brands (product/listing brand
// picker) + single fetch. Replica-backed (CQRS); metric per call; bounded keyset list. No writes here — brands
// are written in apps/admin-api (Law 11). Exported for other modules (e.g. listings hydration) — services only.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { BrandRepository } from '../repositories/brand.repository';
import { BrandNotFoundError } from '../domain/catalogue.errors';
import { QueryBrandDto } from '../dto/query-brand.dto';

const encodeCursor = (name: string, id: string) => Buffer.from(`${name}|${id}`).toString('base64');
const decodeCursor = (c?: string) => { if (!c) return undefined; const idx = Buffer.from(c, 'base64').toString().lastIndexOf('|'); const s = Buffer.from(c, 'base64').toString(); return idx > 0 ? { name: s.slice(0, idx), id: s.slice(idx + 1) } : undefined; };

@Injectable()
export class BrandService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly repo: BrandRepository) {}

  async list(tenantId: string, q: QueryBrandDto) {
    return timed(this.metrics, 'catalogue.brands', { tenant: tenantId }, async () => {
      const rows = await this.repo.list(tenantId, { q: q.q, verifiedOnly: q.verifiedOnly, cursor: decodeCursor(q.cursor), limit: q.limit });
      const items = rows.map((b) => b.toJSON());
      const last = rows[rows.length - 1] as any;
      return { items, nextCursor: rows.length === q.limit && last ? encodeCursor(last.defaultName, last.id) : null };
    });
  }

  async get(tenantId: string, id: string) {
    const b = await this.repo.getById(tenantId, id);
    if (!b) throw new BrandNotFoundError(id);
    return b.toJSON();
  }
}
