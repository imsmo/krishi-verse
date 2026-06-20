// @krishi-verse/sdk-js · listings resource (the marketplace browse surface, GET /v1/listings).
import { HttpClient } from '../http';
import { ListingCard, ListingQuery, Page } from '../types';

export class ListingsResource {
  constructor(private readonly http: HttpClient) {}

  /** Browse/search published listings (keyset cursor). Anonymous (public catalogue). */
  async browse(query: ListingQuery = {}, signal?: AbortSignal): Promise<Page<ListingCard>> {
    const r = await this.http.request<ListingCard[]>('GET', 'listings', {
      anonymous: true, signal,
      query: { q: query.q, categoryId: query.categoryId, regionId: query.regionId, saleType: query.saleType,
        organic: query.organic, priceMinMinor: query.priceMinMinor, priceMaxMinor: query.priceMaxMinor,
        sort: query.sort, cursor: query.cursor, limit: query.limit },
    });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null, total: (r.meta?.total as number | null) ?? null };
  }
  /** A single published listing by id. */
  async get(id: string, signal?: AbortSignal): Promise<ListingCard> {
    return (await this.http.request<ListingCard>('GET', `listings/${encodeURIComponent(id)}`, { anonymous: true, signal })).data;
  }
}
