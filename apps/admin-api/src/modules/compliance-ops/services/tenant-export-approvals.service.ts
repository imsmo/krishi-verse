// apps/admin-api/src/modules/compliance-ops/services/tenant-export-approvals.service.ts · the data-egress gate.
// A tenant full-export / DPDP portability bundle is a major mass-PII egress; platform compliance must APPROVE it
// before the worker runs it (the worker claims only approval_status='approved'). One ACID tx: lock the job →
// decideExport guard (already-decided → 409) → set approval_status + approved_by → audit-in-tx. Approval never
// runs the export itself (that's the worker) and moves no data here — it just authorizes.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ComplianceRepository, ExportListQuery } from '../repositories/compliance.repository';
import { ExportJobNotFoundError } from '../domain/compliance-ops.errors';
import { decideExport } from '../domain/export-approval';
import { DecideExportDto } from '../dto/compliance-ops.dto';

@Injectable()
export class TenantExportApprovalsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ComplianceRepository) {}

  async decide(actor: AdminRequestContext, id: string, dto: DecideExportDto) {
    return this.pool.withTx(async (client) => {
      const job = await this.repo.getExportForUpdate(client, id);
      if (!job) throw new ExportJobNotFoundError(id);
      const next = decideExport(job.approvalStatus, dto.decision);     // throws ExportAlreadyDecidedError
      await this.repo.decideExport(client, id, next, actor.userId, dto.reason);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: next === 'approved' ? 'dpdp.export_approved' : 'dpdp.export_rejected',
        entityType: 'data_export_job', entityId: id, oldValue: { approvalStatus: job.approvalStatus },
        newValue: { approvalStatus: next, jobKind: job.jobKind }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { id, approvalStatus: next, jobKind: job.jobKind, tenantId: job.tenantId };
    });
  }

  async list(q: ExportListQuery) {
    const rows = await this.repo.listExports(q);
    const last = rows[rows.length - 1] as any;
    const nextCursor = rows.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items: rows, nextCursor };
  }
}
