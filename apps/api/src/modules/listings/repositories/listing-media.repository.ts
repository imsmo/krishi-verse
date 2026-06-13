// modules/listings/repositories/listing-media.repository.ts
// Links uploaded media assets to a listing (ordered). Previously create() accepted
// mediaIds and silently dropped them — this persists them in the same tx as the
// listing insert so a listing is never created with orphaned/lost photos.
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class ListingMediaRepository {
  /** Attach media to a listing within the caller's transaction (idempotent per (listing, media)). */
  async attach(tx: TxContext, tenantId: string, listingId: string, mediaIds: string[]): Promise<void> {
    let sort = 0;
    for (const mediaId of mediaIds) {
      await tx.query(
        `INSERT INTO listing_media (id, tenant_id, listing_id, media_id, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (listing_id, media_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [uuidv7(), tenantId, listingId, mediaId, sort++],
      );
    }
  }
}
