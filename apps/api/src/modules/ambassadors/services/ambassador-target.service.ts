// modules/ambassadors/services/ambassador-target.service.ts · per-period goals.
// SETTING a target is an admin act (ambassador.manage) — an ambassador cannot set their own goal (Law 6/11).
// READING is the ambassador's own (resolved from the token) or an admin reading any ambassador's. One ACID tx
// on write, event to the outbox (Law 4); duplicate (ambassador+metric+period) → 409.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { AmbassadorTarget, TargetMetric } from '../domain/ambassador-target.entity';
import { DomainEvent } from '../domain/ambassadors.events';
import { AmbassadorTargetRepository } from '../repositories/ambassador-target.repository';
import { AmbassadorProfileRepository } from '../repositories/ambassador-profile.repository';
import { AmbassadorActor } from './ambassador-profile.service';
import { AmbassadorsForbiddenError, AmbassadorNotFoundError, DuplicateTargetError, NotAnAmbassadorError } from '../domain/ambassadors.errors';
import { SetTargetDto } from '../dto/create-target.dto';

@Injectable()
export class AmbassadorTargetService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly repo: AmbassadorTargetRepository,
    private readonly profiles: AmbassadorProfileRepository,
  ) {}

  /** Admin sets a goal for an ambassador. */
  async set(tenantId: string, actor: AmbassadorActor, dto: SetTargetDto) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    return this.uow.run(tenantId, async (tx) => {
      const target = await this.profiles.getById(tenantId, dto.ambassadorId, tx);
      if (!target) throw new AmbassadorNotFoundError(dto.ambassadorId);
      if (await this.repo.existsFor(tx, dto.ambassadorId, dto.metric, dto.periodStart)) throw new DuplicateTargetError();
      const t = AmbassadorTarget.set({
        id: uuidv7(), tenantId, ambassadorId: dto.ambassadorId, metric: dto.metric as TargetMetric,
        periodStart: dto.periodStart, periodEnd: dto.periodEnd, targetValue: BigInt(dto.targetValue),
      });
      await this.repo.insert(tx, t);
      await this.flush(tx, tenantId, t.id, t.pullEvents());
      return t.toJSON();
    }, { userId: actor.userId });
  }

  /** The caller-ambassador's own targets. */
  async listMine(tenantId: string, userId: string, limit: number) {
    const me = await this.profiles.findByUser(tenantId, userId);
    if (!me) throw new NotAnAmbassadorError();
    const rows = await this.repo.listForAmbassador(tenantId, me.toProps().id, limit);
    return { items: rows.map((t) => t.toJSON()) };
  }

  /** Admin reads any ambassador's targets. */
  async listFor(tenantId: string, actor: AmbassadorActor, ambassadorId: string, limit: number) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    const rows = await this.repo.listForAmbassador(tenantId, ambassadorId, limit);
    return { items: rows.map((t) => t.toJSON()) };
  }

  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'ambassador_target', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
