// modules/listings/read-models/listing-search.read-model.ts
// CQRS READ PATH. Browse/search NEVER touches the write primary (Law 6). Queries
// hit OpenSearch; if the cluster is degraded the SearchClient falls back to a
// read-replica query (resilience). Results are tenant-scoped at the query level
// AND re-asserted by RLS on any DB fallback (defense in depth).
import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_CLIENT, SearchClient } from '../../../core/search/search.client';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { QueryListingDto } from '../dto/query-listing.dto';

export interface ListingCard {
  id: string; title: string; priceMinor: string; currencyCode: string;
  unitCode: string; quantityAvailable: number; organicClaim: boolean;
  saleType: string; regionId: string | null; sellerUserId: string; boosted: boolean;
}
export interface SearchResult { items: ListingCard[]; total: number; nextCursor: string | null; }

@Injectable()
export class ListingSearchReadModel {
  constructor(
    @Inject(SEARCH_CLIENT) private readonly search: SearchClient,
    @Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  async query(tenantId: string, q: QueryListingDto): Promise<SearchResult> {
    return timed(this.metrics, 'listing.search', { tenant: tenantId }, async () => {
      const must: any[] = [{ term: { tenant_id: tenantId } }, { term: { status: 'published' } }, { term: { visibility: 'public' } }];
      if (q.categoryId) must.push({ term: { category_id: q.categoryId } });
      if (q.organicOnly) must.push({ term: { organic_claim: true } });
      if (q.saleType) must.push({ term: { sale_type: q.saleType } });
      if (q.regionId) must.push({ term: { region_id: q.regionId } });
      const range: any = {};
      if (q.minPriceMinor != null) range.gte = q.minPriceMinor;
      if (q.maxPriceMinor != null) range.lte = q.maxPriceMinor;
      if (Object.keys(range).length) must.push({ range: { price_minor: range } });

      try {
        const res = await this.search.search('listings', {
          query: q.text
            ? { bool: { must, should: [{ match: { title: { query: q.text, boost: 3 } } }, { match: { description: q.text } }] } }
            : { bool: { must } },
          sort: this.sort(q), size: q.limit, search_after: q.cursor ? JSON.parse(decode(q.cursor)) : undefined,
        });
        return this.toResult(res, q.limit);
      } catch (err) {
        this.metrics.inc('listing.search.fallback', { tenant: tenantId });
        return this.replicaFallback(tenantId, q);
      }
    });
  }

  private sort(q: QueryListingDto) {
    // Boosted listings always float to the top, then the requested order, then a stable tiebreak.
    const dir = q.sort === 'price_asc' ? 'asc' : 'desc';
    const primary = q.sort?.startsWith('price') ? { price_minor: dir } : { created_at: 'desc' };
    return [{ boost_rank: 'desc' }, primary, { id: 'asc' }];
  }
  private toResult(res: any, limit: number): SearchResult {
    const hits = res.hits?.hits ?? [];
    const items: ListingCard[] = hits.map((h: any) => ({
      id: h._source.id, title: h._source.title, priceMinor: String(h._source.price_minor),
      currencyCode: h._source.currency_code, unitCode: h._source.unit_code,
      quantityAvailable: h._source.quantity_available, organicClaim: !!h._source.organic_claim,
      saleType: h._source.sale_type, regionId: h._source.region_id ?? null,
      sellerUserId: h._source.seller_user_id, boosted: (h._source.boost_rank ?? 0) > 0,
    }));
    const last = hits[hits.length - 1];
    const nextCursor = hits.length === limit && last ? encode(JSON.stringify(last.sort)) : null;
    return { items, total: res.hits?.total?.value ?? items.length, nextCursor };
  }
  private async replicaFallback(tenantId: string, q: QueryListingDto): Promise<SearchResult> {
    // Degraded mode: simple keyset query on a replica. RLS guarantees tenant isolation.
    const pool = await this.replica.forTenant(tenantId);
    const rows = await pool.query(
      `SELECT id, title, price_minor, currency_code, unit_code, quantity_available,
              organic_claim, sale_type, region_id, seller_user_id
         FROM listings
        WHERE tenant_id = $1 AND status = 'published' AND visibility = 'public'
          AND ($2::uuid IS NULL OR category_id = $2)
        ORDER BY created_at DESC, id ASC
        LIMIT $3`, [tenantId, q.categoryId ?? null, q.limit]);
    const items = rows.rows.map((r: any) => ({
      id: r.id, title: r.title, priceMinor: String(r.price_minor), currencyCode: r.currency_code,
      unitCode: r.unit_code, quantityAvailable: r.quantity_available, organicClaim: r.organic_claim,
      saleType: r.sale_type, regionId: r.region_id, sellerUserId: r.seller_user_id, boosted: false,
    }));
    return { items, total: items.length, nextCursor: null };
  }
}
const encode = (s: string) => Buffer.from(s).toString('base64url');
const decode = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
