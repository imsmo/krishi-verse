// apps/admin-api/src/modules/compliance-ops/services/breach-response-console.service.ts · the DPDP §8 breach
// console. Open a breach incident and drive it through the lifecycle (open→contained→notified→closed). One ACID
// tx per write; every transition writes an append-only audit_log row IN THE SAME TX (§4). "notify" requires BOTH
// the regulator + data-principal notification timestamps (DPDP §8) — the controller validates their presence and
// the entity stamps them. The incident record stores affected-data CATEGORIES only — never raw PII.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ComplianceRepository, BreachListQuery } from '../repositories/compliance.repository';
import { Breach } from '../domain/breach.entity';
import { BreachNotFoundError, InvalidBreachUpdateError } from '../domain/compliance-ops.errors';
import { OpenBreachDto, UpdateBreachDto } from '../dto/compliance-ops.dto';

@Injectable()
export class BreachResponseConsoleService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ComplianceRepository) {}

  async open(actor: AdminRequestContext, dto: OpenBreachDto) {
    const breach = Breach.rehydrate({
      id: randomUUID(), affectedTenantId: dto.affectedTenantId ?? null, status: 'open', severity: dto.severity,
      title: dto.title, affectedCount: dto.affectedCount, detectedAt: new Date(dto.detectedAt),
      containedAt: null, regulatorNotifiedAt: null, principalsNotifiedAt: null, closedAt: null, resolutionNote: null,
    });
    return this.pool.withTx(async (client) => {
      await this.repo.insertBreach(client, breach, actor.userId, dto.description, dto.affectedData, actor.userId);
      const p = breach.toJSON();
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'dpdp.breach_opened', entityType: 'data_breach', entityId: p.id,
        newValue: { severity: p.severity, affectedCount: p.affectedCount, affectedTenantId: p.affectedTenantId }, reason: dto.title, ip: actor.ip, requestId: actor.requestId || null });
      return p;
    });
  }

  async update(actor: AdminRequestContext, id: string, dto: UpdateBreachDto) {
    return this.pool.withTx(async (client) => {
      const breach = await this.repo.getBreachForUpdate(client, id);
      if (!breach) throw new BreachNotFoundError(id);
      const before = breach.status;
      let change;
      if (dto.action === 'contain') {
        change = breach.contain();
      } else if (dto.action === 'notify') {
        if (!dto.regulatorNotifiedAt || !dto.principalsNotifiedAt) {
          throw new InvalidBreachUpdateError('notify requires both regulatorNotifiedAt and principalsNotifiedAt (DPDP §8)');
        }
        change = breach.markNotified(new Date(dto.regulatorNotifiedAt), new Date(dto.principalsNotifiedAt));
      } else {
        change = breach.close(dto.note);
      }
      await this.repo.updateBreach(client, breach, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `dpdp.breach_${change.to}`, entityType: 'data_breach', entityId: id,
        oldValue: { status: before }, newValue: { status: change.to }, reason: dto.note, ip: actor.ip, requestId: actor.requestId || null });
      return breach.toJSON();
    });
  }

  async get(id: string) {
    const b = await this.repo.getBreach(id);
    if (!b) throw new BreachNotFoundError(id);
    return b.toJSON();
  }

  async list(q: BreachListQuery) {
    const rows = await this.repo.listBreaches(q);
    const items = rows.map((b) => b.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
