// modules/ambassadors/events/handlers/order-completed.handler.ts · consumes orders.order_completed.
// If the SELLER (a farmer) was referred by an ambassador, accrue a sale commission ('first_sale_facilitated':
// rate_bps of the order total, capped) to that ambassador. Runs inside the relay's per-event tx; IDEMPOTENT
// (the earning is keyed on the order id via existsFor). Money-free here — payout happens in the weekly batch.
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { ReferralRepository } from '../../repositories/referral.repository';
import { AmbassadorProfileRepository } from '../../repositories/ambassador-profile.repository';
import { AmbassadorEarningService } from '../../services/ambassador-earning.service';

const SALE_EVENT = 'first_sale_facilitated';

export class OrderCompletedHandler implements OutboxHandler {
  readonly eventType = 'orders.order_completed';
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly profiles: AmbassadorProfileRepository,
    private readonly earnings: AmbassadorEarningService,
  ) {}
  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const sellerUserId = event.payload.sellerUserId as string | undefined;
    const totalRaw = event.payload.totalMinor as string | undefined;
    if (!tenantId || !sellerUserId || !totalRaw) return;          // malformed event — fail closed
    const referral = await this.referrals.findByReferee(tenantId, sellerUserId, tx);
    if (!referral) return;                                         // seller wasn't referred → no commission
    const ambassador = await this.profiles.findByUser(tenantId, referral.referrerUserId, tx);
    if (!ambassador || !ambassador.isActive) return;
    await this.earnings.accrue(tx, { tenantId, ambassadorId: ambassador.id, eventCode: SALE_EVENT, referenceType: 'order', referenceId: event.aggregateId, baseMinor: BigInt(totalRaw) });
  }
}
