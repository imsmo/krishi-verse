// modules/catalogue/services/category-attribute.service.ts · READ use-case: the raw attribute BINDINGS of a
// category branch (incl. inherited), so a client can see required/filter/card flags + conditionals. Replica-backed
// (CQRS); metric per call. No writes here — bindings are written in apps/admin-api (Law 11).
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { CategoryAttributeRepository } from '../repositories/category-attribute.repository';

@Injectable()
export class CategoryAttributeService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly repo: CategoryAttributeRepository) {}

  async listForCategory(tenantId: string, categoryId: string) {
    return timed(this.metrics, 'catalogue.category_attribute_bindings', { tenant: tenantId }, async () => {
      return (await this.repo.listForCategory(tenantId, categoryId)).map((b) => b.toJSON());
    });
  }
}
