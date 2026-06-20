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
  /** A single published listing by id (public/visibility-gated). */
  async get(id: string, signal?: AbortSignal): Promise<ListingCard> {
    return (await this.http.request<ListingCard>('GET', `listings/${encodeURIComponent(id)}`, { anonymous: true, signal })).data;
  }

  /** A single listing the AUTHENTICATED caller owns (same path, but authenticated → owner can see drafts). */
  async getOwn(id: string, signal?: AbortSignal): Promise<ListingCard> {
    return (await this.http.request<ListingCard>('GET', `listings/${encodeURIComponent(id)}`, { signal })).data;
  }

  /** Create a listing (draft). `mediaIds` are confirmed uploads (core/media). Idempotency-keyed (Law 3). */
  async create(dto: CreateListingInput, idempotencyKey: string): Promise<{ id: string }> {
    return (await this.http.request<{ id: string }>('POST', 'listings', { idempotencyKey, body: dto })).data;
  }

  /** Publish a draft listing (owner-only, server-enforced). */
  async publish(id: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', `listings/${encodeURIComponent(id)}/publish`)).data;
  }

  /** Change price with optimistic concurrency (expectedVersion). Money is a bigint minor-unit string (Law 2). */
  async changePrice(id: string, priceMinor: string, expectedVersion: number): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('PATCH', `listings/${encodeURIComponent(id)}/price`, { body: { priceMinor, expectedVersion } })).data;
  }

  /** Start a paid visibility boost. `paymentTxnId` proves the wallet already captured payment (Law 2). */
  async startBoost(id: string, dto: { boostTierId: string; priceMinor: string; currencyCode?: string; days: number; paymentTxnId: string }, idempotencyKey: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', `listings/${encodeURIComponent(id)}/boosts`, { idempotencyKey, body: dto })).data;
  }
}

/** Create-listing payload (mirrors the API zod .strict() CreateListingSchema). Money is a string of minor units. */
export interface CreateListingInput {
  productId: string; categoryId: string; title: string; description?: string;
  quantityTotal: number; minOrderQty?: number; unitCode: string;
  priceMinor: string; currencyCode?: string;
  saleType?: 'direct' | 'auction' | 'both' | 'preorder' | 'service' | 'group_lot';
  organicClaim?: 'none' | 'natural' | 'certified';
  pincode?: string; regionId?: string; visibility?: 'tenant' | 'cross_tenant' | 'public';
  mediaIds?: string[];
}
