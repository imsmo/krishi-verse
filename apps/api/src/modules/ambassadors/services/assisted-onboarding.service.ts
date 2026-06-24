// modules/ambassadors/services/assisted-onboarding.service.ts · ambassador-assisted farmer onboarding (PRD §16.10).
// An active ambassador onboards a farmer who can't self-register. Composes EXISTING server-owned primitives so
// there is one source of truth for each concern (Law 11): identity.UserService.adminCreate (idempotent-by-phone
// user creation + 'user.created_assisted' audit), identity.ConsentService.grant (DPDP consent, channel
// 'ambassador_assisted', assistedBy = the ambassador) and the referral engine for ATTRIBUTION (a 'signed_up'
// referral linking farmer→ambassador). The onboarding COMMISSION is NOT self-granted here — it accrues only
// when an admin ACTIVATES the referral (the existing audited ambassador.manage gate). The whole op is idempotent
// on the caller's key (Law 3): re-running returns the same farmer (phone-unique) without duplicate side effects.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { UserService } from '../../identity/services/user.service';
import { ConsentService } from '../../identity/services/consent.service';
import { Referral } from '../domain/referral.entity';
import { DomainEvent } from '../domain/ambassadors.events';
import { ReferralRepository } from '../repositories/referral.repository';
import { AmbassadorProfileRepository } from '../repositories/ambassador-profile.repository';
import { AmbassadorActor } from './ambassador-profile.service';
import { NotAnAmbassadorError, ConsentRequiredError } from '../domain/ambassadors.errors';
import { AssistedOnboardingDto } from '../dto/assisted-onboarding.dto';

@Injectable()
export class AssistedOnboardingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly users: UserService,
    private readonly consents: ConsentService,
    private readonly referrals: ReferralRepository,
    private readonly profiles: AmbassadorProfileRepository,
  ) {}

  async onboard(tenantId: string, actor: AmbassadorActor, idemKey: string, dto: AssistedOnboardingDto, ip: string | null) {
    if (!dto.consents.some((c) => c.granted)) throw new ConsentRequiredError();   // DPDP: no consent → no account
    const me = await this.profiles.findByUser(tenantId, actor.userId);
    if (!me || !me.toProps().isActive) throw new NotAnAmbassadorError();
    const ambassadorUserId = me.toProps().userId;

    return this.idem.remember(idemKey, actor.userId, 'ambassadors.assisted_onboard', () =>
      timed(this.metrics, 'ambassadors.assisted_onboard', { tenant: tenantId }, async () => {
        // 1. create / resolve the farmer (idempotent by phone; audited 'user.created_assisted')
        const user = await this.users.adminCreate(tenantId, actor.userId,
          { phone: dto.phone, fullName: dto.fullName, languageCode: dto.languageCode, countryCode: dto.countryCode }, ip);

        // 2. record each DPDP consent on the farmer's behalf, stamped channel=ambassador_assisted + assistedBy
        for (const c of dto.consents) {
          await this.consents.grant(tenantId, user.id, { purposeCode: c.purposeCode, granted: c.granted, channel: 'ambassador_assisted', assistedBy: ambassadorUserId });
        }

        // 3. attribution: a 'signed_up' referral farmer→ambassador (idempotent; commission accrues on admin activation)
        const referralId = await this.attribute(tenantId, ambassadorUserId, user.id);
        return { user, ambassadorId: me.toProps().id, referralId };
      }));
  }

  /** Link the new farmer to the ambassador as a 'signed_up' referral, unless the farmer already has one. */
  private async attribute(tenantId: string, ambassadorUserId: string, refereeUserId: string): Promise<string | null> {
    return this.uow.run(tenantId, async (tx) => {
      const existing = await this.referrals.findByReferee(tenantId, refereeUserId, tx);
      if (existing) return existing.toJSON().id as string;          // already attributed — no duplicate
      const code = `AMB-${uuidv7().slice(0, 8).toUpperCase()}`;
      const r = Referral.create({ id: uuidv7(), tenantId, referrerUserId: ambassadorUserId, refereeUserId: null, code, rewardRule: {} });
      r.signUp(refereeUserId);
      await this.referrals.insert(tx, r);
      await this.flush(tx, tenantId, r.id, r.pullEvents());
      return r.id;
    }, { userId: ambassadorUserId });
  }

  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'referral', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
