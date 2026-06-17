// modules/catalogue/services/attribute-definition.service.ts · attributes (+options) for a category.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';

@Injectable()
export class AttributeDefinitionService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly repo: AttributeDefinitionRepository) {}
  async forCategory(tenantId: string, categoryId: string, filtersOnly: boolean) {
    return timed(this.metrics, 'catalogue.attributes_for_category', { tenant: tenantId }, async () => {
      const rows = await this.repo.forCategory(tenantId, categoryId, filtersOnly);
      return rows.map((r) => ({ ...r.def.props, required: r.required, showInFilters: r.showInFilters, showOnCard: r.showOnCard, options: r.options }));
    });
  }
}
