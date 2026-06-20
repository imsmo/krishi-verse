// modules/schemes/services/dbt-transfer.service.ts · record an observed PFMS/DBT credit (officer).
// NO in-platform wallet movement — the benefit was credited to the beneficiary's bank by the government;
// this records the confirmed credit for the dashboard. One ACID tx (UoW), outbox in-tx (Law 4), authz THROWS.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { DbtTransfer } from '../domain/dbt-transfer.entity';
import { DomainEvent } from '../domain/schemes.events';
import { DbtTransferRepository } from '../repositories/dbt-transfer.repository';
import { SchemeApplicationRepository } from '../repositories/scheme-application.repository';
import { RecordDbtDto } from '../dto/create-dbt-transfer.dto';
import { ApplicationNotFoundError, SchemesForbiddenError } from '../domain/schemes.errors';

export interface SchemesActor { userId: string; canApply: boolean; canProcess: boolean; }

@Injectable()
export class DbtTransferService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: DbtTransferRepository,
    private readonly applications: SchemeApplicationRepository,
  ) {}
  async record(tenantId: string, actor: SchemesActor, applicationId: string, dto: RecordDbtDto, ip: string | null) {
    if (!actor.canProcess) throw new SchemesForbiddenError('requires scheme.process');
    return timed(this.metrics, 'schemes.dbt.record', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const app = await this.applications.getForUpdate(tx, tenantId, applicationId);
        if (!app) throw new ApplicationNotFoundError(applicationId);
        const t = DbtTransfer.record({ id: uuidv7(), tenantId, applicationId, userId: app.applicantUserId, schemeId: app.schemeId, amountMinor: BigInt(dto.amountMinor), instalmentNo: dto.instalmentNo ?? null, creditedOn: dto.creditedOn, pfmsRef: dto.pfmsRef ?? null });
        await this.repo.insert(tx, t);
        // First confirmed credit moves an approved application to 'disbursed'.
        if (app.status === 'approved') { app.markDisbursed(); await this.applications.update(tx, app); await this.applications.appendEvent(tx, tenantId, app.id, 'approved', 'disbursed', dto.pfmsRef ?? null, actor.userId); for (const e of app.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'scheme_application', aggregateId: app.id, eventType: e.type, payload: { v: 1, ...e.payload } }); }
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'schemes.dbt.recorded', entityType: 'dbt_transfer', entityId: t.id, newValue: { applicationId, amountMinor: dto.amountMinor, pfmsRef: dto.pfmsRef ?? null }, ip });
        await this.flush(tx, tenantId, t.id, t.pullEvents());
        return t.toJSON();
      }, { userId: actor.userId }));
  }
  async listForApplication(tenantId: string, actor: SchemesActor, applicationId: string) {
    const app = await this.applications.getById(tenantId, applicationId);
    if (!app) throw new ApplicationNotFoundError(applicationId);
    if (app.applicantUserId !== actor.userId && !actor.canProcess) throw new ApplicationNotFoundError(applicationId); // 404, no IDOR
    return (await this.repo.listForApplication(tenantId, applicationId)).map((t) => t.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'dbt_transfer', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
