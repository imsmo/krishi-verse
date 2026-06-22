// modules/catalogue/repositories/category-attribute.repository.ts · READ-ONLY attribute BINDINGS of a category
// branch INCLUDING inherited ones (ltree: an ancestor's path @> the target's path) — GLOBAL master, written in
// apps/admin-api (Law 11). Replica reads (CQRS). Returns the binding metadata (required/filters/card/condition);
// the hydrated definitions+options form lives in AttributeDefinitionRepository.forCategory.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { CategoryAttribute } from '../domain/category-attribute.entity';

const COLS = `ca.id, ca.category_id, ca.attribute_id, ca.is_required, ca.show_in_filters, ca.show_on_card, ca.condition, ca.sort_order`;
const toBinding = (r: any) => new CategoryAttribute({ id: r.id, categoryId: r.category_id, attributeId: r.attribute_id, isRequired: r.is_required, showInFilters: r.show_in_filters, showOnCard: r.show_on_card, condition: r.condition ?? null, sortOrder: r.sort_order });
const MAX = 500;

@Injectable()
export class CategoryAttributeRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Bindings of `categoryId` and ALL its ancestors (inherited down the tree), ordered for the form. */
  async listForCategory(tenantId: string, categoryId: string): Promise<CategoryAttribute[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS}
         FROM category_attributes ca
         JOIN categories cat ON cat.id = ca.category_id AND cat.deleted_at IS NULL
        WHERE cat.path @> (SELECT path FROM categories WHERE id = $1)
          AND ca.deleted_at IS NULL
        ORDER BY ca.sort_order ASC, ca.attribute_id ASC LIMIT ${MAX}`,
      [categoryId]);
    return r.rows.map(toBinding);
  }
}
