// modules/listings/read-models/listing-search.read-model.ts
// CQRS READ PATH. Browse/search NEVER touches the write primary (Law 12): it runs
// on the tenant's read REPLICA, with RLS re-asserting tenant isolation at the DB.
// Phase 1 uses a parameterised, keyset-paginated SQL query (stable, index-friendly
// at scale). Phase 2 swaps in an OpenSearch projection (relevance, synonyms,
// geo) fed by the outbox — same method signature, no controller change.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { QueryListingDto } from '../dto/query-listing.dto';

export interface ListingCard {
  id: string; title: string; priceMinor: string; currencyCode: string;
  unitCode: string; quantityAvailable: number; organicClaim: boolean;
  saleType: string; regionId: string | null; sellerUserId: string; boosted: boolean;
}
export interface SearchResult { items: ListingCard[]; total: number | null; nextCursor: string | null; }

const encode = (s: string) => Buffer.from(s).toString('base64url');
const decode = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

@Injectable()
export class ListingSearchReadModel {
  constructor(
    @Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  async query(tenantId: string, q: QueryListingDto): Promise<SearchResult> {
    return timed(this.metrics, 'listing.search', { tenant: tenantId }, async () => {
      const params: unknown[] = [tenantId];
      const where: string[] = [
        `tenant_id = $1`, `status = 'published'`,
        `visibility IN ('public','cross_tenant')`, `deleted_at IS NULL`,
      ];
      const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

      if (q.categoryId) where.push(`category_id = ${p(q.categoryId)}`);
      if (q.regionId) where.push(`region_id = ${p(q.regionId)}`);
      if (q.saleType) where.push(`sale_type = ${p(q.saleType)}`);
      if (q.organic) where.push(`organic_claim <> 'none'`);
      if (q.priceMinMinor) where.push(`price_minor >= ${p(q.priceMinMinor)}`);
      if (q.priceMaxMinor) where.push(`price_minor <= ${p(q.priceMaxMinor)}`);
      if (q.q) where.push(`title ILIKE '%' || ${p(q.q)} || '%'`);

      // keyset pagination on (created_at, id) — stable + index-friendly
      if (q.cursor) {
        try {
          const c = JSON.parse(decode(q.cursor)) as { c: string; id: string };
          const cc = p(c.c), ci = p(c.id);
          where.push(`(created_at < ${cc} OR (created_at = ${cc} AND id < ${ci}))`);
        } catch { /* ignore malformed cursor → first page */ }
      }

      const order = q.sort === 'price_asc' ? `price_minor ASC, id DESC`
        : q.sort === 'price_desc' ? `price_minor DESC, id DESC`
        : `created_at DESC, id DESC`;
      const limit = q.limit;
      const limitParam = p(limit + 1); // fetch one extra to detect next page

      const sql = `
        SELECT id, title, price_minor, currency_code, unit_code, quantity_available,
               organic_claim, sale_type, region_id, seller_user_id, created_at
          FROM listings
         WHERE ${where.join(' AND ')}
         ORDER BY ${order}
         LIMIT ${limitParam}`;

      const exec = this.replica.forTenant(tenantId);
      const r = await exec.query<any>(sql, params);
      const rows = r.rows;
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      const items: ListingCard[] = page.map((row) => ({
        id: row.id, title: row.title, priceMinor: String(row.price_minor),
        currencyCode: row.currency_code, unitCode: row.unit_code,
        quantityAvailable: Number(row.quantity_available),
        organicClaim: row.organic_claim != null && row.organic_claim !== 'none',
        saleType: row.sale_type, regionId: row.region_id ?? null,
        sellerUserId: row.seller_user_id, boosted: false,
      }));

      const last = page[page.length - 1];
      const nextCursor = hasMore && last
        ? encode(JSON.stringify({ c: new Date(last.created_at).toISOString(), id: last.id }))
        : null;

      return { items, total: null, nextCursor };
    });
  }
}
