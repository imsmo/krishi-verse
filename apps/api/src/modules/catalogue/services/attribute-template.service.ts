// modules/catalogue/services/attribute-template.service.ts · READ use-case: browse + fetch clonable presets the
// listing-create "use a template" flow consumes. Replica-backed (CQRS); metric per call; bounded keyset list.
// No writes here — global templates are written in apps/admin-api (Law 11). Returns a nextCursor for paging.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AttributeTemplateRepository } from '../repositories/attribute-template.repository';
import { AttributeTemplateNotFoundError } from '../domain/catalogue.errors';
import { QueryAttributeTemplateDto } from '../dto/query-attribute-template.dto';

const encodeCursor = (code: string, id: string) => Buffer.from(`${code}|${id}`).toString('base64');
const decodeCursor = (c?: string) => { if (!c) return undefined; const [code, id] = Buffer.from(c, 'base64').toString().split('|'); return code && id ? { code, id } : undefined; };

@Injectable()
export class AttributeTemplateService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly repo: AttributeTemplateRepository) {}

  async list(tenantId: string, q: QueryAttributeTemplateDto) {
    return timed(this.metrics, 'catalogue.attribute_templates', { tenant: tenantId }, async () => {
      const rows = await this.repo.list(tenantId, { categoryId: q.categoryId, code: q.code, cursor: decodeCursor(q.cursor), limit: q.limit });
      const items = rows.map((t) => t.toJSON());
      const last = rows[rows.length - 1];
      return { items, nextCursor: rows.length === q.limit && last ? encodeCursor(last.code, last.id) : null };
    });
  }

  async getByCode(tenantId: string, code: string) {
    const t = await this.repo.getByCode(tenantId, code);
    if (!t) throw new AttributeTemplateNotFoundError(code);
    return t.toJSON();   // resolveItems() validates the payload; a malformed master row → 422, never a 500
  }
}
