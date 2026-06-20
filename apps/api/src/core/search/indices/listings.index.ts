// core/search/indices/listings.index.ts · the `listings` search index (marketplace browse/relevance).
// Doc shape mirrors the ListingCard the read-model returns, plus the mandatory tenant_id keyword and a
// created_at for keyset sort. Money stays as a STRING (bigint minor units never become JS floats — Law 2);
// price_sort is a numeric copy used ONLY for ordering, derived safely from the same minor-unit integer.
import { IndexDef, KV_ANALYSIS } from './index-def';

export const LISTINGS_INDEX: IndexDef = {
  logical: 'listings',
  textFields: ['title'],
  body: {
    settings: { number_of_shards: 1, number_of_replicas: 1, analysis: KV_ANALYSIS },
    mappings: {
      dynamic: 'strict',
      properties: {
        tenant_id: { type: 'keyword' },
        title: { type: 'text', analyzer: 'kv_text' },
        price_minor: { type: 'keyword' },          // bigint minor units, as a string — never math'd in JS
        price_sort: { type: 'long' },               // ordering only
        currency_code: { type: 'keyword' },
        unit_code: { type: 'keyword' },
        quantity_available: { type: 'double' },
        organic_claim: { type: 'boolean' },
        sale_type: { type: 'keyword' },
        category_id: { type: 'keyword' },
        region_id: { type: 'keyword' },
        seller_user_id: { type: 'keyword' },
        status: { type: 'keyword' },
        created_at: { type: 'date' },
      },
    },
  },
  source: {
    table: 'listings',
    idCol: 'id',
    timeCol: 'created_at',
    indexableWhere: `status = 'published' AND visibility IN ('public','cross_tenant') AND deleted_at IS NULL`,
  },
  project: (row) => ({
    id: String(row.id),
    doc: {
      tenant_id: String(row.tenant_id),
      title: row.title ?? '',
      price_minor: String(row.price_minor),
      price_sort: Number.isFinite(Number(row.price_minor)) ? Number(row.price_minor) : 0,
      currency_code: row.currency_code,
      unit_code: row.unit_code,
      quantity_available: row.quantity_available != null ? Number(row.quantity_available) : 0,
      organic_claim: row.organic_claim != null && row.organic_claim !== 'none',
      sale_type: row.sale_type,
      category_id: row.category_id ?? null,
      region_id: row.region_id ?? null,
      seller_user_id: row.seller_user_id,
      status: row.status,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    },
  }),
  isIndexable: (row) => row.status === 'published' && (row.visibility === 'public' || row.visibility === 'cross_tenant') && row.deleted_at == null,
  // Any of these wake a re-sync; the handler re-reads the row and indexes-or-drops via isIndexable.
  eventTypes: ['listing.published', 'listing.price_changed', 'listing.stock_changed', 'listing.boost_started', 'listing.sold_out', 'listing.status_changed'],
};
