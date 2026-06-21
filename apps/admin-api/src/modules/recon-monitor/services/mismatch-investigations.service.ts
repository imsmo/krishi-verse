// apps/admin-api/src/modules/recon-monitor/services/mismatch-investigations.service.ts · open + work a
// reconciliation mismatch investigation. One ACID tx per write (Law 4); every state change writes an
// append-only audit_log row IN THE SAME TX (§4). Status transitions go only through the entity's state machine
// (Law 5). A partial-unique index guarantees one OPEN investigation per run (dedup the alert storm). This module
// NEVER posts to the ledger — it tracks the human workflow over a money-safety alarm.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ReconRepository, InvestigationListQuery } from '../repositories/recon.repository';
import { Investigation } from '../domain/investigation.entity';
import { ReconRunNotFoundError, InvestigationNotFoundError } from '../domain/recon-monitor.errors';
import { OpenInvestigationDto, UpdateInvestigationDto } from '../dto/recon-monitor.dto';

@Injectable()
export class MismatchInvestigationsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ReconRepository) {}

  async open(actor: AdminRequestContext, dto: OpenInvestigationDto) {
    if (!(await this.repo.runExists(dto.runId))) throw new ReconRunNotFoundError(dto.runId);
    const inv = Investigation.rehydrate({
      id: randomUUID(), runId: dto.runId, status: 'open', severity: dto.severity, summary: dto.summary,
      assignedTo: dto.assignedTo ?? null, resolutionNote: null, openedBy: actor.userId, resolvedAt: null,
    });
    return this.pool.withTx(async (client) => {
      await this.repo.insertInvestigation(client, inv, actor.userId);   // 23505 → DuplicateInvestigationError
      const p = inv.toJSON();
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'recon.investigation_opened', entityType: 'recon_investigation', entityId: p.id,
        newValue: { runId: p.runId, severity: p.severity, status: p.status }, reason: dto.summary, ip: actor.ip, requestId: actor.requestId || null });
      return p;
    });
  }

  async update(actor: AdminRequestContext, id: string, dto: UpdateInvestigationDto) {
    return this.pool.withTx(async (client) => {
      const inv = await this.repo.getInvestigationForUpdate(client, id);
      if (!inv) throw new InvestigationNotFoundError(id);
      const before = inv.status;
      const change = dto.action === 'start' ? inv.startInvestigating(dto.assignedTo ?? null)
        : dto.action === 'resolve' ? inv.resolve(dto.note)
        : inv.markFalsePositive(dto.note);                              // throws on illegal transition
      await this.repo.updateInvestigation(client, inv, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `recon.investigation_${change.to}`, entityType: 'recon_investigation', entityId: id,
        oldValue: { status: before }, newValue: { status: change.to }, reason: dto.note, ip: actor.ip, requestId: actor.requestId || null });
      return inv.toJSON();
    });
  }

  async get(id: string) {
    const inv = await this.repo.getInvestigation(id);
    if (!inv) throw new InvestigationNotFoundError(id);
    return inv.toJSON();
  }

  async list(q: InvestigationListQuery) {
    const rows = await this.repo.listInvestigations(q);
    const items = rows.map((i) => i.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
