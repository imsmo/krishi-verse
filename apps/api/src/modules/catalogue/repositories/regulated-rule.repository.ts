// modules/catalogue/repositories/regulated-rule.repository.ts · READ-ONLY regulated-input rules (GLOBAL master,
// no tenant_id — WRITTEN in apps/admin-api, Law 11). Replica reads (CQRS). Resolves the rules applying to a
// product OR its category branch (incl. inherited ancestors via ltree), filtered to the effective window + region
// in SQL; the domain entity re-checks effectiveness/region (defence in depth). Bounded LIMIT.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { RegulatedRule, RuleType } from '../domain/regulated-rule.entity';

const COLS = `id, product_id, category_id, rule_type, region_id, payload, effective_from, effective_to`;
const toDomain = (r: any): RegulatedRule => new RegulatedRule({
  id: r.id, productId: r.product_id ?? null, categoryId: r.category_id ?? null, ruleType: r.rule_type as RuleType,
  regionId: r.region_id ?? null, payload: r.payload ?? {}, effectiveFrom: String(r.effective_from).slice(0, 10), effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
});
const MAX = 200;

@Injectable()
export class RegulatedRuleRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Rules for a product and/or its category branch (ancestors included via ltree), effective today, for a region. */
  async resolve(tenantId: string, q: { productId?: string; categoryId?: string; regionId?: string }): Promise<RegulatedRule[]> {
    const ex = this.replica.forTenant(tenantId);
    const today = new Date().toISOString().slice(0, 10);
    const r = await ex.query(
      `SELECT ${COLS} FROM regulated_product_rules
        WHERE deleted_at IS NULL
          AND effective_from <= $1::date AND (effective_to IS NULL OR effective_to >= $1::date)
          AND ($4::uuid IS NULL OR region_id IS NULL OR region_id = $4)
          AND (
            ($2::uuid IS NOT NULL AND product_id = $2)
            OR ($3::uuid IS NOT NULL AND category_id IN (
              SELECT anc.id FROM categories anc
              WHERE anc.path @> (SELECT path FROM categories WHERE id = $3) AND anc.deleted_at IS NULL))
          )
        ORDER BY rule_type ASC, id ASC LIMIT ${MAX}`,
      [today, q.productId ?? null, q.categoryId ?? null, q.regionId ?? null]);
    return r.rows.map(toDomain);
  }
}
