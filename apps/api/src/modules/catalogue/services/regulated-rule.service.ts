// modules/catalogue/services/regulated-rule.service.ts · READ use-case: resolve the regulated-input rules that
// apply to a product / category (branch) in a region, effective today. This is the listing-time compliance hook
// (Phase-2 enforcement): a seller listing a pesticide in a banned state, or a prescription/license-required input,
// is gated by these rules. Replica-backed (CQRS); metric per call. Rules are GLOBAL master (written in admin-api,
// Law 11) — read-only here. The domain entity re-checks effectiveness/region (defence in depth).
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { RegulatedRuleRepository } from '../repositories/regulated-rule.repository';
import { QueryRegulatedRuleDto } from '../dto/query-certificate.dto';

@Injectable()
export class RegulatedRuleService {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly repo: RegulatedRuleRepository) {}

  async resolve(tenantId: string, q: QueryRegulatedRuleDto) {
    return timed(this.metrics, 'catalogue.regulated_rules', { tenant: tenantId }, async () => {
      const rules = await this.repo.resolve(tenantId, { productId: q.productId, categoryId: q.categoryId, regionId: q.regionId });
      const asOf = new Date();
      // SQL already filters; the entity re-checks (defence in depth) and shapes the response.
      return rules.filter((r) => r.isEffective(asOf) && r.appliesToRegion(q.regionId ?? null)).map((r) => r.toJSON());
    });
  }
}
