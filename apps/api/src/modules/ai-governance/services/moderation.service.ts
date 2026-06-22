// modules/ai-governance/services/moderation.service.ts · content abuse reports. Any authenticated user FILES a
// report (deduped per reporter+subject by the unique index — a spammer creates one row, not thousands: §4
// abuse guard); a moderator (content.moderate) HANDLES it (action/dismiss). One ACID tx per write, outbox
// in-tx (Law 4), audit on moderator actions. ModerationFiled fires only on the FIRST open report for a subject
// (notify moderators once, not per duplicate). Money-free.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AiGovernancePublisher } from '../events/ai-governance.publisher';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ModerationReport } from '../domain/moderation-report.entity';
import { DomainEvent } from '../domain/ai-governance.events';
import { ModerationReportRepository } from '../repositories/moderation-report.repository';
import { ModerationReportNotFoundError, InvalidModerationError, AiForbiddenError } from '../domain/ai-governance.errors';
import { AiActor } from './ai-inference.service';
import { FileReportDto } from '../dto/file-moderation-report.dto';
import { HandleReportDto } from '../dto/handle-moderation.dto';

@Injectable()
export class ModerationService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly publisher: AiGovernancePublisher,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly reports: ModerationReportRepository,
  ) {}

  /** File a report. Any authenticated user. Duplicate (same reporter+subject) is a silent no-op. */
  async file(tenantId: string, actor: AiActor, dto: FileReportDto) {
    return timed(this.metrics, 'ai.moderation.file', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const reasonId = await this.reports.resolveReasonId(tx, dto.reasonCode);
        if (!reasonId) throw new InvalidModerationError('unknown report reason');
        // First OPEN report for the subject? → emit ModerationFiled once (notify moderators).
        const openBefore = await this.reports.countOpenForSubject(tx, tenantId, dto.subjectType, dto.subjectId);
        const report = ModerationReport.file({ id: uuidv7(), tenantId, reporterUserId: actor.userId, subjectType: dto.subjectType, subjectId: dto.subjectId, reasonId, details: dto.details ?? null });
        const inserted = await this.reports.insertDeduped(tx, report);
        if (!inserted) { this.metrics.inc('ai.moderation.duplicate'); return { id: null, deduped: true }; }
        if (openBefore === 0) await this.flush(tx, tenantId, report.id, report.pullEvents());   // only the first open report notifies
        this.metrics.inc('ai.moderation.filed');
        return { ...report.toJSON(), deduped: false };
      }, { userId: actor.userId }));
  }

  /** Moderator decision (open → actioned | dismissed). */
  async handle(tenantId: string, actor: AiActor, id: string, dto: HandleReportDto, ip: string | null) {
    if (!actor.canModerate) throw new AiForbiddenError('requires content.moderate');
    return timed(this.metrics, 'ai.moderation.handle', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const report = await this.reports.getForUpdate(tx, tenantId, id);
        if (!report) throw new ModerationReportNotFoundError(id);
        report.handle(actor.userId, dto.status, dto.action ?? null);
        await this.reports.update(tx, report);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `moderation.${dto.status}`, entityType: 'moderation_report', entityId: id, newValue: { status: dto.status, action: dto.action ?? null }, reason: dto.note ?? null, ip });
        await this.flush(tx, tenantId, id, report.pullEvents());
        return report.toJSON();
      }, { userId: actor.userId }));
  }

  async getById(tenantId: string, actor: AiActor, id: string) {
    if (!actor.canModerate) throw new AiForbiddenError('requires content.moderate');
    const report = await this.reports.getById(tenantId, id);
    if (!report) throw new ModerationReportNotFoundError(id);
    return report.toJSON();
  }
  async list(tenantId: string, actor: AiActor, q: { box: 'open' | 'all'; subjectType?: string; subjectId?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (!actor.canModerate) throw new AiForbiddenError('requires content.moderate');
    const rows = await this.reports.listFor(tenantId, q);
    const items = rows.map((r) => r.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, reportId: string, evts: DomainEvent[]): Promise<void> {
    await this.publisher.publish(tx, tenantId, 'moderation_report', reportId, evts);
  }
}
