// modules/listings/repositories/listing-media.repository.ts
// Links uploaded media assets to a listing's PUBLIC GALLERY. Previously create() accepted
// mediaIds and silently dropped them — this persists them in the same tx as the
// listing insert so a listing is never created with orphaned/lost photos.
//
// KV-MF-14 FIX (founder video review): attach() used to INSERT into a `listing_media` table that
// was never part of the real schema (db/migrations) — it only ever existed in a test-only SQL
// fixture (apps/api/test/sql/reference-slices/00_listings_slice.sql), a leftover from an early
// draft of this vertical slice (see LISTINGS_SLICE_NOTES.md) that predates the canonical
// polymorphic `media_links` table (entity_type/entity_id/purpose, db/migrations/0001_foundation.sql
// §0.6). Meanwhile ListingGalleryReadModel (GET /listings/:id/media) was correctly rewritten to
// read from `media_links` — so a photo uploaded at listing-create time was written to a table
// nobody ever reads from, and the gallery / "Listing health → Add more photos (N)" count on the
// farmer's own detail screen always saw zero, no matter how many clean photos existed. Fixed by
// writing to `media_links` (purpose='gallery'), the SAME table the read side already queries.
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class ListingMediaRepository {
  /** Attach media to a listing's gallery within the caller's transaction, in order (CREATE-time only —
   *  sort_order starts fresh at 0). Idempotent per (listing, media): media_links carries no unique
   *  constraint to ON CONFLICT against, so a repeat attach is guarded with a WHERE NOT EXISTS instead. */
  async attach(tx: TxContext, tenantId: string, listingId: string, mediaIds: string[]): Promise<void> {
    let sort = 0;
    for (const mediaId of mediaIds) {
      await tx.query(
        `INSERT INTO media_links (id, media_id, entity_type, entity_id, purpose, sort_order)
         SELECT $1, $2, 'listing', $3, 'gallery', $4
          WHERE NOT EXISTS (
            SELECT 1 FROM media_links WHERE entity_type = 'listing' AND entity_id = $3 AND media_id = $2
          )`,
        [uuidv7(), mediaId, listingId, sort++],
      );
    }
  }

  /** A clean, scanned IMAGE media asset the caller uploaded (anti-IDOR: only the uploader's own media;
   *  tenant-owned or platform-shared) — the gate before letting a farmer attach a photo to their OWN
   *  EXISTING listing (KV-MF-14 "Add more photos" cta). Mirrors
   *  ListingTrustDocumentRepository.mediaAttachable exactly, except kind='image' (a gallery photo) not
   *  'document' (a trust document / lab report). */
  async photoAttachable(tx: TxContext, tenantId: string, mediaAssetId: string, userId: string): Promise<boolean> {
    const r = await tx.query<{ ok: boolean }>(
      `SELECT true AS ok FROM media_assets
         WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) AND uploader_user_id = $3
           AND kind = 'image' AND scan_status = 'clean' AND deleted_at IS NULL`,
      [mediaAssetId, tenantId, userId]);
    return !!r.rows[0]?.ok;
  }

  /** Count of gallery media currently attached to a listing (mirrors CreateListingSchema's mediaIds
   *  max(10) cap, enforced again here for photos added AFTER creation via addPhoto()). */
  async countForListing(tx: TxContext, listingId: string): Promise<number> {
    const r = await tx.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM media_links WHERE entity_type = 'listing' AND entity_id = $1 AND purpose = 'gallery'`,
      [listingId]);
    return Number(r.rows[0]?.n ?? 0);
  }

  /** Append ONE photo to the end of a listing's gallery (KV-MF-14 "Add more photos" — adding to an
   *  ALREADY-CREATED listing, unlike attach() which only ever runs inside listing creation). Idempotent —
   *  re-attaching the same media is a no-op (same WHERE NOT EXISTS guard as attach()). */
  async attachOne(tx: TxContext, listingId: string, mediaId: string): Promise<void> {
    const sortOrder = await this.countForListing(tx, listingId);
    await tx.query(
      `INSERT INTO media_links (id, media_id, entity_type, entity_id, purpose, sort_order)
       SELECT $1, $2, 'listing', $3, 'gallery', $4
        WHERE NOT EXISTS (
          SELECT 1 FROM media_links WHERE entity_type = 'listing' AND entity_id = $3 AND media_id = $2
        )`,
      [uuidv7(), mediaId, listingId, sortOrder],
    );
  }
}
