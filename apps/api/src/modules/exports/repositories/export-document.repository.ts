// modules/exports/repositories/export-document.repository.ts · all SQL for export_documents. tenant_id in
// EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Resolves the export_doc lookup.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ExportDocument } from '../domain/export-document.entity';
import { DocumentStatus } from '../domain/export-document.state';
import { InvalidDocTypeError } from '../domain/exports.errors';

const COLS = `id, shipment_id, tenant_id, doc_type_id, media_id, status, reference_no, created_at`;
function toDomain(r: any): ExportDocument {
  return ExportDocument.rehydrate({ id: r.id, shipmentId: r.shipment_id, tenantId: r.tenant_id, docTypeId: r.doc_type_id, mediaId: r.media_id, status: r.status as DocumentStatus, referenceNo: r.reference_no, createdAt: r.created_at });
}
@Injectable()
export class ExportDocumentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  /** Resolve an export_doc lookup CODE → platform lookup_values id (never trust a client-supplied id). */
  async resolveDocTypeId(tx: TxContext, code: string): Promise<string> {
    const r = await tx.query(`SELECT id FROM lookup_values WHERE type_code='export_doc' AND code=$1 AND tenant_id IS NULL AND is_active=true`, [code]);
    if (!r.rows[0]) throw new InvalidDocTypeError(code);
    return r.rows[0].id;
  }
  async insert(tx: TxContext, d: ExportDocument): Promise<void> {
    const p = d.toProps();
    await tx.query(`INSERT INTO export_documents (id, shipment_id, tenant_id, doc_type_id, media_id, status, reference_no, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)`,
      [p.id, p.shipmentId, p.tenantId, p.docTypeId, p.mediaId, p.status, p.referenceNo]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ExportDocument | null> {
    const r = await tx.query(`SELECT ${COLS} FROM export_documents WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, d: ExportDocument): Promise<void> {
    const p = d.toProps();
    await tx.query(`UPDATE export_documents SET status=$3, media_id=$4, reference_no=$5, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.status, p.mediaId, p.referenceNo]);
  }
  async listForShipment(tenantId: string, shipmentId: string, tx?: TxContext): Promise<ExportDocument[]> {
    const sql = `SELECT ${COLS} FROM export_documents WHERE tenant_id=$1 AND shipment_id=$2 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 200`;
    const r = tx ? await tx.query(sql, [tenantId, shipmentId]) : await this.replica.forTenant(tenantId).query(sql, [tenantId, shipmentId]);
    return r.rows.map(toDomain);
  }
  /** The ship gate: count of documents not yet 'verified' for a shipment (read within the tx). */
  async countNotVerified(tx: TxContext, tenantId: string, shipmentId: string): Promise<{ total: number; notVerified: number }> {
    const r = await tx.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status <> 'verified')::int not_verified FROM export_documents WHERE tenant_id=$1 AND shipment_id=$2 AND deleted_at IS NULL`, [tenantId, shipmentId]);
    return { total: r.rows[0]?.total ?? 0, notVerified: r.rows[0]?.not_verified ?? 0 };
  }
}
