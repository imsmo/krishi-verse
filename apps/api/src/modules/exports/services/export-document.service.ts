// modules/exports/services/export-document.service.ts · checklist documents on an export shipment.
// add (resolve doc-type lookup) + set-status (pending→submitted→verified|rejected). One ACID tx (UoW),
// state via the machine (Law 5), outbox in-tx (Law 4), authz THROWS (Law 6: the shipment's exporter/admin).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ExportDocument } from '../domain/export-document.entity';
import { DocumentStatus } from '../domain/export-document.state';
import { DomainEvent } from '../domain/exports.events';
import { ExportDocumentRepository } from '../repositories/export-document.repository';
import { ExportShipmentRepository } from '../repositories/export-shipment.repository';
import { AddDocumentDto, SetDocumentStatusDto } from '../dto/create-export-document.dto';
import { ShipmentNotFoundError, DocumentNotFoundError, ExportsForbiddenError } from '../domain/exports.errors';
import { ExportsActor } from './exporter-registration.service';

@Injectable()
export class ExportDocumentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ExportDocumentRepository,
    private readonly shipments: ExportShipmentRepository,
  ) {}

  async add(tenantId: string, actor: ExportsActor, shipmentId: string, dto: AddDocumentDto) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return timed(this.metrics, 'exports.document.add', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const shipment = await this.shipments.getById(tenantId, shipmentId, tx);
        if (!shipment) throw new ShipmentNotFoundError(shipmentId);
        if (shipment.exporterUserId !== actor.userId && !actor.isAdmin) throw new ExportsForbiddenError('only the exporter may add documents');
        const docTypeId = await this.repo.resolveDocTypeId(tx, dto.docTypeCode);
        const d = ExportDocument.add({ id: uuidv7(), shipmentId, tenantId, docTypeId, mediaId: dto.mediaId ?? null, referenceNo: dto.referenceNo ?? null });
        await this.repo.insert(tx, d);
        await this.flush(tx, tenantId, d.id, d.pullEvents());
        return d.toJSON();
      }, { userId: actor.userId }));
  }

  async setStatus(tenantId: string, actor: ExportsActor, id: string, dto: SetDocumentStatusDto) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return this.uow.run(tenantId, async (tx) => {
      const d = await this.repo.getForUpdate(tx, tenantId, id);
      if (!d) throw new DocumentNotFoundError(id);
      const shipment = await this.shipments.getById(tenantId, d.shipmentId, tx);
      if (!shipment || (shipment.exporterUserId !== actor.userId && !actor.isAdmin)) throw new ExportsForbiddenError('only the exporter may update documents');
      d.setStatus(dto.status as DocumentStatus, dto.mediaId, dto.referenceNo);
      await this.repo.update(tx, d);
      await this.flush(tx, tenantId, d.id, d.pullEvents());
      return d.toJSON();
    }, { userId: actor.userId });
  }

  async list(tenantId: string, actor: ExportsActor, shipmentId: string) {
    const shipment = await this.shipments.getById(tenantId, shipmentId);
    if (!shipment) throw new ShipmentNotFoundError(shipmentId);
    if (shipment.exporterUserId !== actor.userId && !actor.isAdmin) throw new ShipmentNotFoundError(shipmentId); // 404, no IDOR
    return (await this.repo.listForShipment(tenantId, shipmentId)).map((d) => d.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'export_document', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
