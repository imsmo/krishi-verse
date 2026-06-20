// modules/ambassadors/services/ambassador-profile.service.ts · enroll + manage ambassadors (admin).
// enroll/suspend/update need ambassador.manage (Law 11 — not self-grant) + write an audit row in the same tx.
// One profile per user (409 on duplicate). getMine resolves the caller's own profile. authz THROWS.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { AmbassadorProfile } from '../domain/ambassador-profile.entity';
import { DomainEvent } from '../domain/ambassadors.events';
import { AmbassadorProfileRepository } from '../repositories/ambassador-profile.repository';
import { EnrollAmbassadorDto, UpdateAmbassadorDto } from '../dto/enroll-ambassador.dto';
import { AmbassadorNotFoundError, AlreadyAmbassadorError, AmbassadorsForbiddenError } from '../domain/ambassadors.errors';

export interface AmbassadorActor { userId: string; canManage: boolean; }

@Injectable()
export class AmbassadorProfileService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: AmbassadorProfileRepository,
  ) {}

  async enroll(tenantId: string, actor: AmbassadorActor, dto: EnrollAmbassadorDto, ip: string | null) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    return timed(this.metrics, 'ambassadors.enroll', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        if (await this.repo.findByUser(tenantId, dto.userId, tx)) throw new AlreadyAmbassadorError(dto.userId);
        const a = AmbassadorProfile.enroll({ id: uuidv7(), userId: dto.userId, tenantId, clusterRegionIds: dto.clusterRegionIds, tierId: dto.tierId ?? null,
          mentorAmbassadorId: dto.mentorAmbassadorId ?? null, trainingCompletedAt: null, kioskEnabled: dto.kioskEnabled, aepsEnabled: dto.aepsEnabled, monthlyStipendMinor: BigInt(dto.monthlyStipendMinor) });
        await this.repo.insert(tx, a);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'ambassador.enrolled', entityType: 'ambassador_profile', entityId: a.id, newValue: { userId: dto.userId }, ip });
        await this.flush(tx, tenantId, a.id, a.pullEvents());
        return a.toJSON();
      }, { userId: actor.userId }));
  }
  async update(tenantId: string, actor: AmbassadorActor, id: string, dto: UpdateAmbassadorDto) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    return this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, id);
      if (!a) throw new AmbassadorNotFoundError(id);
      a.update({ ...dto, monthlyStipendMinor: dto.monthlyStipendMinor !== undefined ? BigInt(dto.monthlyStipendMinor) : undefined, trainingCompletedAt: dto.trainingCompleted ? new Date() : undefined });
      await this.repo.update(tx, a);
      return a.toJSON();
    }, { userId: actor.userId });
  }
  async setActive(tenantId: string, actor: AmbassadorActor, id: string, active: boolean, ip: string | null) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    return this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, id);
      if (!a) throw new AmbassadorNotFoundError(id);
      if (active) a.reinstate(); else a.suspend();
      await this.repo.update(tx, a);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: active ? 'ambassador.reinstated' : 'ambassador.suspended', entityType: 'ambassador_profile', entityId: id, ip });
      await this.flush(tx, tenantId, id, a.pullEvents());
      return a.toJSON();
    }, { userId: actor.userId });
  }
  async getById(tenantId: string, id: string) { const a = await this.repo.getById(tenantId, id); if (!a) throw new AmbassadorNotFoundError(id); return a.toJSON(); }
  async getMine(tenantId: string, actor: AmbassadorActor) { const a = await this.repo.findByUser(tenantId, actor.userId); if (!a) throw new AmbassadorNotFoundError('me'); return a.toJSON(); }
  async list(tenantId: string, actor: AmbassadorActor, q: { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((a) => a.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'ambassador_profile', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
