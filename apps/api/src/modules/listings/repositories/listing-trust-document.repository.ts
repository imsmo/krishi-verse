// modules/listings/repositories/listing-trust-document.repository.ts · attachments linking a listing ↔ a clean
// media asset (KV-BL-031, screen 112 trust badge). Tenant-scoped (RLS backstop + explicit tenant_id); reads via
// the replica, writes in the tx. Mirrors schemes/repositories/scheme-document.repository.ts's shape.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export type TrustDocType = 'lab_report' | 'certification' | 'other';
export interface ListingTrustDocumentRow {
  id: string; listingId: string; mediaAssetId: string; docType: TrustDocType; verifiedAt: string | null;
  uploadedBy: string; createdAt: string;
}
function toRow(r: any): ListingTrustDocumentRow {
  return {
    id: r.id, listingId: r.listing_id, mediaAssetId: r.media_id, docType: r.doc_type,
    verifiedAt: r.verified_at ? (r.verified_at instanceof Date ? r.verified_at.toISOString() : String(r.verified_at)) : null,
    uploadedBy: r.uploaded_by, createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

@Injectable()
export class ListingTrustDocumentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** A clean, scanned DOCUMENT media asset the caller uploaded (anti-IDOR: only the uploader's own media; tenant
   *  or platform-shared). Mirrors SchemeDocumentRepository.mediaAttachable exactly. */
  async mediaAttachable(tx: TxContext, tenantId: string, mediaAssetId: string, userId: string): Promise<boolean> {
    const r = await tx.query<{ ok: boolean }>(
      `SELECT true AS ok FROM media_assets
         WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND uploader_user_id=$3
           AND kind='document' AND scan_status='clean' AND deleted_at IS NULL`,
      [mediaAssetId, tenantId, userId]);
    return !!r.rows[0]?.ok;
  }

  async insert(tx: TxContext, rec: { id: string; tenantId: string; listingId: string; mediaAssetId: string; docType: TrustDocType; uploadedBy: string }): Promise<void> {
    await tx.query(
      `INSERT INTO listing_trust_documents (id, tenant_id, listing_id, media_id, doc_type, uploaded_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (listing_id, media_id) WHERE deleted_at IS NULL DO NOTHING`,
      [rec.id, rec.tenantId, rec.listingId, rec.mediaAssetId, rec.docType, rec.uploadedBy]);
  }

  /** The live row for (listing, media) — correct whether this call just inserted it OR a prior attach already
   *  exists (ON CONFLICT DO NOTHING no-op case), unlike looking up by the just-generated id. */
  async getByListingAndMedia(tx: TxContext, tenantId: string, listingId: string, mediaAssetId: string): Promise<ListingTrustDocumentRow | null> {
    const r = await tx.query(
      `SELECT id, listing_id, media_id, doc_type, verified_at, uploaded_by, created_at
         FROM listing_trust_documents
        WHERE tenant_id=$1 AND listing_id=$2 AND media_id=$3 AND deleted_at IS NULL`,
      [tenantId, listingId, mediaAssetId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  /** All live trust documents for a listing (bounded; public-ish list — the controller decides visibility). */
  async listForListing(tenantId: string, listingId: string): Promise<ListingTrustDocumentRow[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, listing_id, media_id, doc_type, verified_at, uploaded_by, created_at
         FROM listing_trust_documents
        WHERE tenant_id=$1 AND listing_id=$2 AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 100`,
      [tenantId, listingId]);
    return r.rows.map(toRow);
  }
}
