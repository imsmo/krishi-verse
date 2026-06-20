// core/search/indices/products.index.ts · the `products` catalogue search index. Products are platform-master
// (tenant_id NULL — visible to all tenants, Law 11) OR tenant-owned; the projector maps a NULL tenant to the
// PLATFORM_TENANT sentinel so the tenant-scoped query (tenant_id IN [caller, __platform__]) returns master +
// own products, never another tenant's. Active, non-deleted products only.
import { IndexDef, KV_ANALYSIS } from './index-def';
import { PLATFORM_TENANT } from '../opensearch.client';

export const PRODUCTS_INDEX: IndexDef = {
  logical: 'products',
  textFields: ['name'],
  body: {
    settings: { number_of_shards: 1, number_of_replicas: 1, analysis: KV_ANALYSIS },
    mappings: {
      dynamic: 'strict',
      properties: {
        tenant_id: { type: 'keyword' },
        name: { type: 'text', analyzer: 'kv_text' },
        category_id: { type: 'keyword' },
        default_unit: { type: 'keyword' },
        brand_id: { type: 'keyword' },
        gst_rate_pct: { type: 'double' },
        is_perishable: { type: 'boolean' },
        is_platform: { type: 'boolean' },
        created_at: { type: 'date' },
      },
    },
  },
  source: {
    table: 'products',
    idCol: 'id',
    timeCol: 'created_at',
    indexableWhere: `is_active AND deleted_at IS NULL`,
  },
  project: (row) => ({
    id: String(row.id),
    doc: {
      tenant_id: row.tenant_id == null ? PLATFORM_TENANT : String(row.tenant_id),
      name: row.default_name ?? '',
      category_id: row.category_id ?? null,
      default_unit: row.default_unit ?? null,
      brand_id: row.brand_id ?? null,
      gst_rate_pct: row.gst_rate_pct != null ? Number(row.gst_rate_pct) : null,
      is_perishable: !!row.is_perishable,
      is_platform: row.tenant_id == null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    },
  }),
  isIndexable: (row) => !!row.is_active && row.deleted_at == null,
  eventTypes: ['catalogue.product_created', 'catalogue.product_updated', 'catalogue.product_deactivated'],
};
