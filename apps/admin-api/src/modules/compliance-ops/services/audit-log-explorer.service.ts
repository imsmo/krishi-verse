// apps/admin-api/src/modules/compliance-ops/services/audit-log-explorer.service.ts · READ-ONLY explorer over the
// append-only audit_log (partitioned by created_at). Compliance/auditors search by actor/entity/action/tenant +
// date range. The keyset is over (created_at, id) — the PARTITION KEY first — so PG prunes to one partition
// (Law 8); bounded LIMIT. Audit rows are PII-free by writer contract (the explorer only returns metadata: ids,
// action, reason, ip, request_id — never old/new value blobs that could carry sensitive detail). Cursor encodes
// the created_at + id of the last row.
import { Injectable } from '@nestjs/common';
import { ComplianceRepository, AuditQuery } from '../repositories/compliance.repository';

@Injectable()
export class AuditLogExplorerService {
  constructor(private readonly repo: ComplianceRepository) {}

  async explore(q: AuditQuery) {
    const rows = await this.repo.explorerAudit(q);
    const last = rows[rows.length - 1] as any;
    const nextCursor = rows.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items: rows, nextCursor };
  }
}
