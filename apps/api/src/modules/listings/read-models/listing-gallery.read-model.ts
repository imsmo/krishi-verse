// modules/listings/read-models/listing-gallery.read-model.ts
// The public photo gallery for a listing: media attached via media_links (entity_type='listing'), joined
// to media_assets, CLEAN scan only, ordered. Each clean asset's s3_key is turned into a short-lived
// presigned GET url. Replica-backed (Law 12). AUTHORIZATION: the gallery is only returned for a
// PUBLISHED + publicly-visible listing — a draft/private/cross-tenant-hidden listing yields an empty
// gallery (never leaks an unpublished seller's photos). Infected/pending assets are never presigned.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { OBJECT_STORE, ObjectStore } from '../../../core/media/s3-presign.service';

export interface GalleryItem { mediaId: string; url: string; sortOrder: number; }
const URL_TTL_SEC = 600;   // short-lived signed GET (10 min) — re-fetch the gallery to refresh

@Injectable()
export class ListingGalleryReadModel {
  constructor(
    @Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore,
  ) {}

  /** Signed gallery for a PUBLIC listing. Returns [] if the listing isn't publicly visible or has no clean media. */
  async forListing(tenantId: string, listingId: string): Promise<{ items: GalleryItem[]; expiresInSec: number }> {
    const db = this.replica.forTenant(tenantId);
    const l = await db.query<{ status: string; visibility: string }>(
      `SELECT status, visibility FROM listings WHERE id=$1`, [listingId]);
    const listing = l.rows[0];
    const publiclyVisible = !!listing && listing.status === 'published' && (listing.visibility === 'public' || listing.visibility === 'cross_tenant');
    if (!publiclyVisible) return { items: [], expiresInSec: URL_TTL_SEC };

    const r = await db.query<{ media_id: string; s3_key: string; sort_order: number }>(
      `SELECT ml.media_id, ma.s3_key, ml.sort_order
         FROM media_links ml JOIN media_assets ma ON ma.id = ml.media_id
        WHERE ml.entity_type='listing' AND ml.entity_id=$1 AND ma.scan_status='clean'
        ORDER BY ml.sort_order, ml.created_at`, [listingId]);
    const items = r.rows.map((x) => ({ mediaId: x.media_id, url: this.store.presignDownload(x.s3_key, URL_TTL_SEC), sortOrder: x.sort_order }));
    return { items, expiresInSec: URL_TTL_SEC };
  }
}
