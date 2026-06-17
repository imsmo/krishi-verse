// modules/catalogue/repositories/attribute-definition.repository.ts
// Resolves the attributes that apply to a category — INCLUDING inherited ones from
// ancestor categories (ltree: an ancestor's path contains the target's path). Returns
// each definition with its dropdown options, so the UI can render forms + search facets.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { AttributeDefinition, DataType } from '../domain/attribute-definition.entity';

@Injectable()
export class AttributeDefinitionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async forCategory(tenantId: string, categoryId: string, filtersOnly: boolean): Promise<Array<{ def: AttributeDefinition; required: boolean; showInFilters: boolean; showOnCard: boolean; options: Array<{ id: string; code: string; name: string }> }>> {
    const ex = this.replica.forTenant(tenantId);
    // category_attributes of this category AND all ancestors (path @> target.path)
    const rows = (await ex.query(
      `SELECT ad.id, ad.code, ad.default_name, ad.data_type, ad.unit_code, ad.validation, ad.is_active,
              ca.is_required, ca.show_in_filters, ca.show_on_card, ca.sort_order
         FROM category_attributes ca
         JOIN attribute_definitions ad ON ad.id = ca.attribute_id AND ad.is_active AND ad.deleted_at IS NULL
         JOIN categories cat ON cat.id = ca.category_id
        WHERE cat.path @> (SELECT path FROM categories WHERE id = $1)
          AND ($2 = false OR ca.show_in_filters)
        ORDER BY ca.sort_order, ad.code`,
      [categoryId, filtersOnly])).rows;
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const opts = (await ex.query(
      `SELECT attribute_id, id, code, default_name FROM attribute_options
        WHERE attribute_id = ANY($1) AND is_active AND deleted_at IS NULL ORDER BY sort_order, code`, [ids])).rows;
    const byAttr = new Map<string, Array<{ id: string; code: string; name: string }>>();
    for (const o of opts) { const a = byAttr.get(o.attribute_id) ?? []; a.push({ id: o.id, code: o.code, name: o.default_name }); byAttr.set(o.attribute_id, a); }

    return rows.map((r) => ({
      def: new AttributeDefinition({ id: r.id, code: r.code, defaultName: r.default_name, dataType: r.data_type as DataType, unitCode: r.unit_code, validation: r.validation ?? {}, isActive: r.is_active }),
      required: r.is_required, showInFilters: r.show_in_filters, showOnCard: r.show_on_card, options: byAttr.get(r.id) ?? [],
    }));
  }

  /** Definitions (+ allowed option ids) needed to validate submitted product attribute values. */
  async validatorsByIds(tenantId: string, attributeIds: string[]): Promise<Map<string, { def: AttributeDefinition; optionIds: Set<string> }>> {
    if (attributeIds.length === 0) return new Map();
    const ex = this.replica.forTenant(tenantId);
    const defs = (await ex.query(
      `SELECT id, code, default_name, data_type, unit_code, validation, is_active FROM attribute_definitions WHERE id = ANY($1)`, [attributeIds])).rows;
    const opts = (await ex.query(`SELECT attribute_id, id FROM attribute_options WHERE attribute_id = ANY($1)`, [attributeIds])).rows;
    const optByAttr = new Map<string, Set<string>>();
    for (const o of opts) { const s = optByAttr.get(o.attribute_id) ?? new Set<string>(); s.add(o.id); optByAttr.set(o.attribute_id, s); }
    const out = new Map<string, { def: AttributeDefinition; optionIds: Set<string> }>();
    for (const d of defs) out.set(d.id, { def: new AttributeDefinition({ id: d.id, code: d.code, defaultName: d.default_name, dataType: d.data_type as DataType, unitCode: d.unit_code, validation: d.validation ?? {}, isActive: d.is_active }), optionIds: optByAttr.get(d.id) ?? new Set() });
    return out;
  }
}
