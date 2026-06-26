// modules/schemes/repositories/scheme-document.repository.ts · attachments linking a scheme application ↔ a clean
// media asset (P1-16). Tenant-scoped (RLS backstop + explicit tenant_id); reads via the replica, writes in the tx.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export interface SchemeDocumentRow {
  id: string; applicationId: string; mediaId: string; docTypeId: string | null; note: string | null;
  uploadedBy: string; createdAt: string;
}
function toRow(r: any): SchemeDocumentRow {
  return { id: r.id, applicationId: r.application_id, mediaId: r.media_id, docTypeId: r.doc_type_id ?? null,
    note: r.note ?? null, uploadedBy: r.uploaded_by, createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) };
}

@Injectable()
export class SchemeDocumentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** A clean, scanned media asset the caller uploaded (anti-IDOR: only the uploader's own media; tenant or platform). */
  async mediaAttachable(tx: TxContext, tenantId: string, mediaId: string, userId: string): Promise<boolean> {
    const r = await tx.query<{ ok: boolean }>(
      `SELECT true AS ok FROM media_assets
         WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND uploader_user_id=$3
           AND kind='document' AND scan_status='clean' AND deleted_at IS NULL`,
      [mediaId, tenantId, userId]);
    return !!r.rows[0]?.ok;
  }

  async insert(tx: TxContext, rec: { id: string; tenantId: string; applicationId: string; mediaId: string; docTypeId: string | null; note: string | null; uploadedBy: string }): Promise<void> {
    await tx.query(
      `INSERT INTO scheme_application_documents (id, tenant_id, application_id, media_id, doc_type_id, note, uploaded_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       ON CONFLICT (application_id, media_id) WHERE deleted_at IS NULL DO NOTHING`,
      [rec.id, rec.tenantId, rec.applicationId, rec.mediaId, rec.docTypeId, rec.note, rec.uploadedBy]);
  }

  /** Live attachment by id (in-tx, for detach). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string, applicationId: string): Promise<SchemeDocumentRow | null> {
    const r = await tx.query(
      `SELECT id, application_id, media_id, doc_type_id, note, uploaded_by, created_at
         FROM scheme_application_documents
        WHERE id=$1 AND tenant_id=$2 AND application_id=$3 AND deleted_at IS NULL FOR UPDATE`,
      [id, tenantId, applicationId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  async softDelete(tx: TxContext, tenantId: string, id: string): Promise<void> {
    await tx.query(`UPDATE scheme_application_documents SET deleted_at=now(), updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
  }

  /** All live attachments for an application (bounded; one application's docs). */
  async listForApplication(tenantId: string, applicationId: string): Promise<SchemeDocumentRow[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, application_id, media_id, doc_type_id, note, uploaded_by, created_at
         FROM scheme_application_documents
        WHERE tenant_id=$1 AND application_id=$2 AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 100`,
      [tenantId, applicationId]);
    return r.rows.map(toRow);
  }
}
