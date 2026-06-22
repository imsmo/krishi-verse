// modules/catalogue/services/attribute-option.service.ts · READ use-case: the dropdown options of an attribute
// (form rendering + facet values). Replica-backed (CQRS); cached (hot read) with a tenant-prefixed key; metric
// per call. No writes here — global options are written in apps/admin-api (Law 11).
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AttributeOptionRepository } from '../repositories/attribute-option.repository';

@Injectable()
export class AttributeOptionService {
  constructor(
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: AttributeOptionRepository,
  ) {}

  async listForAttribute(tenantId: string, attributeId: string, activeOnly: boolean) {
    return timed(this.metrics, 'catalogue.attribute_options', { tenant: tenantId }, async () => {
      const load = async () => (await this.repo.listByAttribute(tenantId, attributeId, activeOnly)).map((o) => o.toJSON());
      // options of a global attribute are stable + shared; cache the active set
      return activeOnly ? this.cache.wrap(`catalogue:attr_options:${attributeId}`, 300, load) : load();
    });
  }
}
