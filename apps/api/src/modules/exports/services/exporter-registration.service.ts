// modules/exports/services/exporter-registration.service.ts · exporter RCMC/IEC registration use-cases.
// One ACID tx per write (UoW), outbox in-tx (Law 4), idempotent create (Law 3), authz THROWS (Law 6: owner-only).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ExporterRegistration } from '../domain/exporter-registration.entity';
import { ExportAuthority, DomainEvent } from '../domain/exports.events';
import { ExporterRegistrationRepository } from '../repositories/exporter-registration.repository';
import { RegisterExporterDto } from '../dto/create-exporter-registration.dto';
import { UpdateExporterDto } from '../dto/update-exporter-registration.dto';
import { ExporterNotFoundError, ExportsForbiddenError } from '../domain/exports.errors';

export interface ExportsActor { userId: string; canManage: boolean; isAdmin: boolean; }

@Injectable()
export class ExporterRegistrationService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ExporterRegistrationRepository,
  ) {}
  async register(tenantId: string, actor: ExportsActor, idemKey: string, dto: RegisterExporterDto) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return this.idem.remember(idemKey, actor.userId, 'exports.exporter.register', () =>
      timed(this.metrics, 'exports.exporter.register', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const e = ExporterRegistration.register({ id: uuidv7(), tenantId, exporterUserId: actor.userId, authority: dto.authority as ExportAuthority, regNo: dto.regNo, iecCode: dto.iecCode ?? null, validUntil: dto.validUntil ?? null, docId: dto.docId ?? null });
          await this.repo.insert(tx, e);
          await this.flush(tx, tenantId, e.id, e.pullEvents());
          return e.toJSON();
        }, { userId: actor.userId })));
  }
  async update(tenantId: string, actor: ExportsActor, id: string, dto: UpdateExporterDto) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return this.uow.run(tenantId, async (tx) => {
      const e = await this.repo.getForUpdate(tx, tenantId, id);
      if (!e) throw new ExporterNotFoundError(id);
      if (e.exporterUserId !== actor.userId && !actor.isAdmin) throw new ExportsForbiddenError('only the exporter may edit this registration');
      e.update(dto);
      await this.repo.update(tx, e);
      await this.flush(tx, tenantId, e.id, e.pullEvents());
      return e.toJSON();
    }, { userId: actor.userId });
  }
  async getById(tenantId: string, actor: ExportsActor, id: string) {
    const e = await this.repo.getById(tenantId, id);
    if (!e) throw new ExporterNotFoundError(id);
    if (e.exporterUserId !== actor.userId && !actor.isAdmin) throw new ExporterNotFoundError(id); // 404, no IDOR
    return e.toJSON();
  }
  async list(tenantId: string, actor: ExportsActor, q: { box: 'mine' | 'all'; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new ExportsForbiddenError('requires booking.manage');
    const rows = await this.repo.listFor(tenantId, { exporterUserId: q.box === 'mine' ? actor.userId : undefined, cursor: q.cursor, limit: q.limit });
    const items = rows.map((e) => e.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'exporter_registration', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
