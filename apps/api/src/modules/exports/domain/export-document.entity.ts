// modules/exports/domain/export-document.entity.ts · the export_documents aggregate (checklist-driven).
// BoL/CI/PL/CoO/phyto/… each track a status (pending→submitted→verified|rejected). The doc_type is a
// platform lookup ('export_doc'); the media file is held by the media module (media_id reference).
import { DocumentStatus, assertTransition } from './export-document.state';
import { DomainEvent, ExportsEventType } from './exports.events';

export interface ExportDocumentProps {
  id: string; shipmentId: string; tenantId: string; docTypeId: string; mediaId: string | null; status: DocumentStatus; referenceNo: string | null; createdAt?: Date;
}
export class ExportDocument {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ExportDocumentProps) {}
  static add(input: Omit<ExportDocumentProps, 'status'> & { status?: DocumentStatus }): ExportDocument {
    const d = new ExportDocument({ ...input, status: input.status ?? 'pending' });
    d.events.push({ type: ExportsEventType.DocumentAdded, payload: { documentId: d.props.id, shipmentId: d.props.shipmentId, docTypeId: d.props.docTypeId } });
    return d;
  }
  static rehydrate(props: ExportDocumentProps): ExportDocument { return new ExportDocument(props); }
  get id() { return this.props.id; }
  get shipmentId() { return this.props.shipmentId; }
  get status() { return this.props.status; }
  toProps(): Readonly<ExportDocumentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  setStatus(to: DocumentStatus, mediaId?: string | null, referenceNo?: string | null): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    if (mediaId !== undefined) this.props.mediaId = mediaId;
    if (referenceNo !== undefined) this.props.referenceNo = referenceNo;
    this.events.push({ type: ExportsEventType.DocumentStatusSet, payload: { documentId: this.props.id, shipmentId: this.props.shipmentId, from, to } });
  }
  toJSON() { const v = this.props; return { id: v.id, shipmentId: v.shipmentId, docTypeId: v.docTypeId, mediaId: v.mediaId, status: v.status, referenceNo: v.referenceNo, createdAt: v.createdAt }; }
}
