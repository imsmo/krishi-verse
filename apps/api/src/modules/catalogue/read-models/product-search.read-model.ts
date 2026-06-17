// modules/catalogue/read-models/product-search.read-model.ts
// CQRS read path (Law 12): product browse/search on the tenant's REPLICA, never the write
// primary. Returns platform-master + the tenant's own products. Keyset (cursor) pagination —
// never OFFSET. Full-text via search_tsv with an ILIKE fallback; OpenSearch is Phase 2.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { QueryProductDto } from '../dto/query-product.dto';

export interface ProductCard { id: string; name: string; categoryId: string; defaultUnit: string; brandId: string | null; gstRatePct: number | null; isPerishable: boolean; isPlatform: boolean; }
export interface ProductSearchResult { items: ProductCard[]; nextCursor: string | null; }
const enc = (s: string) => Buffer.from(s).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

@Injectable()
export class ProductSearchReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider, @Inject(METRICS) private readonly metrics: Metrics) {}

  async query(tenantId: string, q: QueryProductDto): Promise<ProductSearchResult> {
    return timed(this.metrics, 'catalogue.product_search', { tenant: tenantId }, async () => {
      const params: unknown[] = [tenantId];
      const where: string[] = ['(tenant_id IS NULL OR tenant_id = $1)', 'deleted_at IS NULL'];
      const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
      if (q.activeOnly) where.push('is_active');
      if (q.categoryId) where.push(`category_id = ${p(q.categoryId)}`);
      if (q.q) where.push(`(search_tsv @@ plainto_tsquery('simple', ${p(q.q)}) OR default_name ILIKE '%' || ${p(q.q)} || '%')`);
      if (q.cursor) {
        try { const c = JSON.parse(dec(q.cursor)) as { c: string; id: string }; const cc = p(c.c), ci = p(c.id);
          where.push(`(created_at < ${cc} OR (created_at = ${cc} AND id < ${ci}))`); } catch { /* first page */ }
      }
      const limit = q.limit;
      const lp = p(limit + 1);
      const sql = `SELECT id, default_name, category_id, default_unit, brand_id, gst_rate_pct, is_perishable, tenant_id, created_at
                     FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${lp}`;
      const r = await this.replica.forTenant(tenantId).query<any>(sql, params);
      const hasMore = r.rows.length > limit;
      const page = hasMore ? r.rows.slice(0, limit) : r.rows;
      const items: ProductCard[] = page.map((row) => ({ id: row.id, name: row.default_name, categoryId: row.category_id, defaultUnit: row.default_unit, brandId: row.brand_id, gstRatePct: row.gst_rate_pct != null ? Number(row.gst_rate_pct) : null, isPerishable: row.is_perishable, isPlatform: row.tenant_id == null }));
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? enc(JSON.stringify({ c: new Date(last.created_at).toISOString(), id: last.id })) : null;
      return { items, nextCursor };
    });
  }
}
