// modules/identity/repositories/business-kyc.repository.ts · buyer business-KYC profile (tenant-scoped ⇒ RLS).
// Stores ONLY masked GSTIN/PAN (the raw values are masked in the domain before they ever reach here). One live
// profile per (tenant, user); submit is an upsert that resets the row to 'pending' for re-review.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export type BusinessKycStatus = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';

export interface BusinessKycRow {
  id: string; tenantId: string; userId: string; businessType: string; legalName: string;
  gstinMasked: string | null; panMasked: string | null; docMediaIds: string[];
  status: BusinessKycStatus; reviewedBy: string | null; reviewedAt: Date | null; rejectReason: string | null;
  createdAt: Date; updatedAt: Date | null;
}

const COLS = `id, tenant_id, user_id, business_type, legal_name, gstin_masked, pan_masked, doc_media_ids,
  status, reviewed_by, reviewed_at, reject_reason, created_at, updated_at`;

function toRow(r: any): BusinessKycRow {
  return {
    id: r.id, tenantId: r.tenant_id, userId: r.user_id, businessType: r.business_type, legalName: r.legal_name,
    gstinMasked: r.gstin_masked, panMasked: r.pan_masked, docMediaIds: r.doc_media_ids ?? [],
    status: r.status, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, rejectReason: r.reject_reason,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

@Injectable()
export class BusinessKycRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Upsert the caller's profile (one per tenant+user). A re-submit overwrites the fields, clears any prior
   *  review, and resets status to 'pending'. Returns the stored row. */
  async upsert(tx: TxContext, v: {
    id: string; tenantId: string; userId: string; businessType: string; legalName: string;
    gstinMasked: string | null; panMasked: string | null; docMediaIds: string[];
  }): Promise<BusinessKycRow> {
    const r = await tx.query(
      `INSERT INTO business_kyc_profiles
         (id, tenant_id, user_id, business_type, legal_name, gstin_masked, pan_masked, doc_media_ids, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$3)
       ON CONFLICT (tenant_id, user_id) WHERE deleted_at IS NULL
       DO UPDATE SET business_type=EXCLUDED.business_type, legal_name=EXCLUDED.legal_name,
         gstin_masked=EXCLUDED.gstin_masked, pan_masked=EXCLUDED.pan_masked, doc_media_ids=EXCLUDED.doc_media_ids,
         status='pending', reviewed_by=NULL, reviewed_at=NULL, reject_reason=NULL, updated_at=now()
       RETURNING ${COLS}`,
      [v.id, v.tenantId, v.userId, v.businessType, v.legalName, v.gstinMasked, v.panMasked, v.docMediaIds]);
    return toRow(r.rows[0]);
  }

  /** The caller's OWN profile (or null). Served from the replica. */
  async getForUser(tenantId: string, userId: string): Promise<BusinessKycRow | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM business_kyc_profiles WHERE tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL`,
      [tenantId, userId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  /** Lock a profile for an admin review decision. */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<BusinessKycRow | null> {
    const r = await tx.query(
      `SELECT ${COLS} FROM business_kyc_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`,
      [id, tenantId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  /** Stamp an admin review decision (verified | rejected + reason). */
  async markReviewed(tx: TxContext, tenantId: string, id: string, status: 'verified' | 'rejected', reviewerId: string, reason: string | null): Promise<void> {
    await tx.query(
      `UPDATE business_kyc_profiles SET status=$3, reviewed_by=$4, reviewed_at=now(), reject_reason=$5, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [id, tenantId, status, reviewerId, reason]);
  }
}
