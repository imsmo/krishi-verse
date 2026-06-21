// @krishi-verse/sdk-js · reviews resource (module 5). A review is bound to a COMPLETED order; the target
// (seller↔buyer) is resolved SERVER-SIDE from verified-purchase eligibility — the client never supplies a
// target id (anti-IDOR). Create carries an Idempotency-Key (Law 3) so a double-tap can't post twice. Summary/list
// read only published reviews. Gated server-side by the `reviews` flag.
import { HttpClient } from '../http';
import { ReviewSummary } from '../types';

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /** Post a review for a completed order. `stars` 1–5; optional sub-ratings/body/tags. */
  async create(input: { orderId: string; stars: number; subRatings?: Record<string, number>; body?: string; tags?: string[] }, idempotencyKey: string): Promise<{ id: string }> {
    return (await this.http.request<{ id: string }>('POST', 'reviews', { idempotencyKey, body: input })).data;
  }
  /** Aggregate rating summary for a target (e.g. a seller). */
  async summary(query: { targetUserId?: string; listingId?: string }, signal?: AbortSignal): Promise<ReviewSummary> {
    return (await this.http.request<ReviewSummary>('GET', 'reviews/summary', { query, signal })).data;
  }
}
