// modules/ambassadors/services/referral.service.ts · the generic referral engine + ambassador accrual hook.
// create: any authenticated user mints a referral code (idempotency-keyed). claim: a NEW user attaches to an
// unclaimed code (signs up; can't self-refer). activate (admin/ambassador.manage): confirms the referee became
// active → if the referrer is an ambassador, accrue 'farmer_onboarded' (one ACID tx, in-tx accrual). authz THROWS.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Referral } from '../domain/referral.entity';
import { DomainEvent } from '../domain/ambassadors.events';
import { ReferralRepository } from '../repositories/referral.repository';
import { AmbassadorProfileRepository } from '../repositories/ambassador-profile.repository';
import { AmbassadorEarningService } from './ambassador-earning.service';
import { CreateReferralDto, ClaimReferralDto } from '../dto/create-referral.dto';
import { ReferralNotFoundError, DuplicateReferralCodeError, SelfReferralError, InvalidReferralError, AmbassadorsForbiddenError } from '../domain/ambassadors.errors';
import { AmbassadorActor } from './ambassador-profile.service';

const ONBOARD_EVENT = 'farmer_onboarded';

@Injectable()
export class ReferralService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ReferralRepository,
    private readonly profiles: AmbassadorProfileRepository,
    private readonly earnings: AmbassadorEarningService,
  ) {}

  async create(tenantId: string, actor: AmbassadorActor, idemKey: string, dto: CreateReferralDto) {
    return this.idem.remember(idemKey, actor.userId, 'ambassadors.referral.create', () =>
      timed(this.metrics, 'ambassadors.referral.create', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          if (await this.repo.findByCode(tx, tenantId, dto.code)) throw new DuplicateReferralCodeError(dto.code);
          const r = Referral.create({ id: uuidv7(), tenantId, referrerUserId: actor.userId, refereeUserId: null, code: dto.code, rewardRule: {} });
          await this.repo.insert(tx, r);
          await this.flush(tx, tenantId, r.id, r.pullEvents());
          return r.toJSON();
        }, { userId: actor.userId })));
  }

  async claim(tenantId: string, actor: AmbassadorActor, dto: ClaimReferralDto) {
    return this.uow.run(tenantId, async (tx) => {
      const r = await this.repo.findByCode(tx, tenantId, dto.code);
      if (!r) throw new ReferralNotFoundError(dto.code);
      if (r.referrerUserId === actor.userId) throw new SelfReferralError();
      if (await this.repo.findByReferee(tenantId, actor.userId, tx)) throw new InvalidReferralError('you have already used a referral code');
      r.signUp(actor.userId);
      await this.repo.update(tx, r);
      return r.toJSON();
    }, { userId: actor.userId });
  }

  /** Admin confirms the referee is active → accrue the onboarding commission to the referrer (if an ambassador). */
  async activate(tenantId: string, actor: AmbassadorActor, id: string) {
    if (!actor.canManage) throw new AmbassadorsForbiddenError('requires ambassador.manage');
    return this.uow.run(tenantId, async (tx) => {
      const r = await this.repo.getForUpdate(tx, tenantId, id);
      if (!r) throw new ReferralNotFoundError(id);
      r.activate();
      await this.repo.update(tx, r);
      await this.flush(tx, tenantId, r.id, r.pullEvents());
      const ambassador = await this.profiles.findByUser(tenantId, r.referrerUserId, tx);
      if (ambassador && ambassador.isActive) {
        await this.earnings.accrue(tx, { tenantId, ambassadorId: ambassador.id, eventCode: ONBOARD_EVENT, referenceType: 'referral', referenceId: r.id, baseMinor: 0n });
      }
      return r.toJSON();
    }, { userId: actor.userId });
  }

  async list(tenantId: string, actor: AmbassadorActor, q: { status?: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listForReferrer(tenantId, actor.userId, q);
    const items = rows.map((r) => r.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'referral', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
