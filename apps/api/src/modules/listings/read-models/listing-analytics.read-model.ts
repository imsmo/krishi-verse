// modules/listings/read-models/listing-analytics.read-model.ts
// CQRS read: a seller's engagement analytics for ONE of their listings. Replica-backed (Law 12), RLS
// re-asserts tenant isolation. OWNER-ONLY: the analytics belong to the listing's seller — a non-owner
// (and non-moderator) gets null → 404 in the controller (no IDOR, no enumeration).
//
// Metrics are derived ONLY from data the platform genuinely has (never fabricated):
//   offers          — buyer offers placed on this listing (a real demand/lead signal: listing_offers)
//   activeBoost      — the live paid boost's end time, or null (listing_boosts)
//   boostsPurchased  — total boosts ever bought for this listing
//   priceChanges     — number of price edits (listing_price_history)
//   views            — REAL per-impression view count (P1-15), read from listing_view_counts: the counted
//                      read-model the stream-processor's view_counter consumer feeds off the event pipeline.
//                      0 until the first view lands; NEVER fabricated. No view-traffic is counted on this read
//                      path (CQRS — counting happens off-band in the stream-processor).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

export interface ListingAnalytics {
  listingId: string; status: string; publishedAt: string | null;
  offers: number; priceChanges: number; boostsPurchased: number; views: number;
  lastViewedAt: string | null;
  activeBoost: { endsAt: string } | null;
}

@Injectable()
export class ListingAnalyticsReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Returns null when the listing doesn't exist OR the viewer isn't its seller (and not a moderator). */
  async forSeller(tenantId: string, listingId: string, viewerUserId: string, canModerate: boolean): Promise<ListingAnalytics | null> {
    const db = this.replica.forTenant(tenantId);
    const lr = await db.query<{ seller_user_id: string; status: string; published_at: Date | null }>(
      `SELECT seller_user_id, status, published_at FROM listings WHERE id=$1`, [listingId]);
    const listing = lr.rows[0];
    if (!listing) return null;
    if (!canModerate && listing.seller_user_id !== viewerUserId) return null;   // owner-only (anti-IDOR)

    const [offers, priceChanges, boosts, views] = await Promise.all([
      db.query<{ n: string }>(`SELECT count(*)::text AS n FROM listing_offers WHERE listing_id=$1`, [listingId]),
      db.query<{ n: string }>(`SELECT count(*)::text AS n FROM listing_price_history WHERE listing_id=$1`, [listingId]),
      db.query<{ n: string; ends_at: Date | null }>(
        `SELECT count(*)::text AS n, max(ends_at) FILTER (WHERE ends_at > now() AND deleted_at IS NULL) AS ends_at
           FROM listing_boosts WHERE listing_id=$1`, [listingId]),
      // P1-15: real view count from the counted read-model (0 row ⇒ no views yet, never fabricated).
      db.query<{ total: string; last_viewed_at: Date | null }>(
        `SELECT total_views::text AS total, last_viewed_at FROM listing_view_counts WHERE listing_id=$1`, [listingId]),
    ]);
    const activeEnds = boosts.rows[0]?.ends_at;
    const viewRow = views.rows[0];
    return {
      listingId, status: listing.status, publishedAt: listing.published_at ? listing.published_at.toISOString() : null,
      offers: Number(offers.rows[0]?.n ?? 0),
      priceChanges: Number(priceChanges.rows[0]?.n ?? 0),
      boostsPurchased: Number(boosts.rows[0]?.n ?? 0),
      views: Number(viewRow?.total ?? 0),
      lastViewedAt: viewRow?.last_viewed_at ? new Date(viewRow.last_viewed_at).toISOString() : null,
      activeBoost: activeEnds ? { endsAt: new Date(activeEnds).toISOString() } : null,
    };
  }
}
