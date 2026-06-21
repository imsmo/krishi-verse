// apps/admin-api/src/modules/compliance-ops/services/data-subject-requests-queue.service.ts · the DPDP rights
// queue. Platform compliance works a data_subject_request (access/erasure/correction/portability) through the
// state machine: open → in_progress → completed | rejected. One ACID tx per write; every transition writes an
// append-only audit_log row IN THE SAME TX (§4). DPDP guard: an erasure cannot be COMPLETED before its 90-day
// cooling window ends (enforced in the entity). The actual data deletion/export is executed by the worker; this
// records the decision + links the export media id.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ComplianceRepository, DsrListQuery } from '../repositories/compliance.repository';
import { DsrNotFoundError } from '../domain/compliance-ops.errors';
import { UpdateDsrDto } from '../dto/compliance-ops.dto';

@Injectable()
export class DataSubjectRequestsQueueService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ComplianceRepository) {}

  async update(actor: AdminRequestContext, id: string, dto: UpdateDsrDto) {
    return this.pool.withTx(async (client) => {
      const dsr = await this.repo.getDsrForUpdate(client, id);
      if (!dsr) throw new DsrNotFoundError(id);
      const before = dsr.status;
      const change = dto.action === 'start' ? dsr.startProgress()
        : dto.action === 'complete' ? dsr.complete(dto.resolution)     // throws ErasureCoolingActiveError if early
        : dsr.reject(dto.resolution);                                   // throws on illegal transition
      if (dto.exportMediaId) dsr.attachExportMedia(dto.exportMediaId);  // link the access/portability bundle
      await this.repo.updateDsr(client, dsr, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `dpdp.dsr_${change.to}`, entityType: 'data_subject_request', entityId: id,
        oldValue: { status: before }, newValue: { status: change.to, requestType: dsr.requestType }, reason: dto.resolution, ip: actor.ip, requestId: actor.requestId || null });
      return dsr.toJSON();
    });
  }

  async get(id: string) {
    const dsr = await this.repo.getDsr(id);
    if (!dsr) throw new DsrNotFoundError(id);
    return dsr.toJSON();
  }

  async list(q: DsrListQuery) {
    const rows = await this.repo.listDsr(q);
    const items = rows.map((d) => d.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
