// modules/ambassadors/services/ambassador-earning.service.ts · accrual + the PAYOUT money path.
// accrue(): resolve the effective commission plan for an event, compute the amount (flat or rate×base capped),
// and append an ambassador_earnings row — IDEMPOTENT via existsFor (the partitioned UNIQUE can't dedupe alone).
// No wallet movement on accrual. payoutAmbassador(): lock the ambassador's unpaid earnings, post ONE zero-sum,
// idempotent 'commission' wallet transfer (platform Fees → ambassador userMain), and stamp payout_id (Law 2/3/4).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { AmbassadorEarning } from '../domain/ambassador-earning.entity';
import { DomainEvent, AmbassadorEventType } from '../domain/ambassadors.events';
import { CommissionPlanRepository } from '../repositories/commission-plan.repository';
import { AmbassadorEarningRepository } from '../repositories/ambassador-earning.repository';
import { AmbassadorProfileRepository } from '../repositories/ambassador-profile.repository';
import { NothingToPayoutError, AmbassadorNotFoundError, AmbassadorsForbiddenError } from '../domain/ambassadors.errors';

export interface AccrueInput { tenantId: string; ambassadorId: string; eventCode: string; referenceType: string | null; referenceId: string | null; baseMinor: bigint; }

@Injectable()
export class AmbassadorEarningService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly plans: CommissionPlanRepository,
    private readonly earnings: AmbassadorEarningRepository,
    private readonly profiles: AmbassadorProfileRepository,
  ) {}

  /** Accrue one commission event inside the caller's tx. Returns null if no plan / zero amount / already credited. */
  async accrue(tx: TxContext, input: AccrueInput): Promise<AmbassadorEarning | null> {
    const plan = await this.plans.resolveEffective(input.tenantId, input.eventCode, tx);
    if (!plan) { this.metrics.inc('ambassadors.accrue.no_plan', { event: input.eventCode }); return null; }
    const amount = plan.compute(input.baseMinor);
    if (amount <= 0n) return null;
    if (await this.earnings.existsFor(tx, input.ambassadorId, input.eventCode, input.referenceId)) { this.metrics.inc('ambassadors.accrue.duplicate', { event: input.eventCode }); return null; }
    const earning = AmbassadorEarning.accrue({ id: uuidv7(), tenantId: input.tenantId, ambassadorId: input.ambassadorId, planId: plan.id, eventCode: input.eventCode, referenceType: input.referenceType, referenceId: input.referenceId, amountMinor: amount });
    await this.earnings.insert(tx, earning);
    for (const e of earning.pullEvents()) await this.outbox.write(tx, { tenantId: input.tenantId, aggregateType: 'ambassador_earning', aggregateId: earning.id, eventType: e.type, payload: { v: 1, ...e.payload } });
    this.metrics.inc('ambassadors.accrue.ok', { event: input.eventCode });
    return earning;
  }

  /** Settle an ambassador's unpaid earnings to their wallet. Admin-gated at the controller; idempotent (Law 3). */
  async payoutAmbassador(tenantId: string, ambassadorId: string, idemKey: string) {
    return this.idem.remember(idemKey, 'system', 'ambassadors.payout', () =>
      timed(this.metrics, 'ambassadors.payout', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const profile = await this.profiles.getById(tenantId, ambassadorId, tx);
          if (!profile) throw new AmbassadorNotFoundError(ambassadorId);
          const unpaid = await this.earnings.lockUnpaid(tx, tenantId, ambassadorId);
          const total = unpaid.reduce((sum, e) => sum + e.amountMinor, 0n);
          if (total <= 0n) throw new NothingToPayoutError(ambassadorId);
          const payoutId = uuidv7();
          await this.wallet.post(tx, { tenantId, txnType: 'commission', idempotencyKey: `ambpayout:${payoutId}`, referenceType: 'ambassador_payout', referenceId: payoutId, initiatedBy: 'system',
            legs: [{ account: platform(PlatformAccount.Fees), amountMinor: -total }, { account: userMain(profile.userId), amountMinor: total }] });
          await this.earnings.markPaid(tx, unpaid.map((e) => ({ id: e.id, createdAt: e.toProps().createdAt as Date })), payoutId);
          await this.outbox.write(tx, { tenantId, aggregateType: 'ambassador_payout', aggregateId: payoutId, eventType: AmbassadorEventType.EarningsPaidOut, payload: { v: 1, payoutId, ambassadorId, userId: profile.userId, totalMinor: total.toString(), count: unpaid.length } });
          return { payoutId, ambassadorId, paidMinor: total.toString(), earningCount: unpaid.length };
        }, { userId: 'system' })));
  }

  async listForAmbassador(tenantId: string, ambassadorId: string, q: { unpaidOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.earnings.listForAmbassador(tenantId, ambassadorId, q);
    const items = rows.map((e) => e.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
export { AmbassadorsForbiddenError };
