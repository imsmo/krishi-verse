// modules/memberships/services/user-membership.service.ts
// Subscription use-cases. subscribe/renew DEBIT the wallet for paid tiers ONLY via the wallet boundary
// (Law 2): userMain → platform fees, a ZERO-SUM, idempotent ledger txn (the wallet's no-overdraw rule
// means a user must actually hold the balance). Free tiers move no money. Every write: one ACID tx (UoW),
// status via the machine (Law 5), outbox in-tx (Law 4). No version column → the membership row is locked
// FOR UPDATE. One LIVE membership per user (guarded under the tx).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { UserMembership } from '../domain/user-membership.entity';
import { DomainEvent, BillingCycle } from '../domain/memberships.events';
import { isLive } from '../domain/user-membership.state';
import { TierNotFoundError, MembershipNotFoundError, MembershipForbiddenError, TierNotSubscribableError, AlreadySubscribedError } from '../domain/memberships.errors';
import { MembershipTierRepository } from '../repositories/membership-tier.repository';
import { UserMembershipRepository } from '../repositories/user-membership.repository';
import { SubscribeDto } from '../dto/create-user-membership.dto';

export interface MembershipActor { userId: string; canManage: boolean; }

@Injectable()
export class UserMembershipService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly audit: AuditWriter,
    private readonly tiers: MembershipTierRepository,
    private readonly repo: UserMembershipRepository,
  ) {}

  /** Subscribe self to a tier (wallet-debited for paid tiers). One live membership per user. */
  async subscribe(tenantId: string, userId: string, idemKey: string, dto: SubscribeDto) {
    return this.idem.remember(idemKey, userId, 'memberships.subscribe', () =>
      timed(this.metrics, 'memberships.subscribe', { tenant: tenantId }, async () => {
        const tier = await this.tiers.getSubscribable(tenantId, dto.tierId);
        if (!tier) throw new TierNotFoundError(dto.tierId);
        if (!tier.isActive) throw new TierNotSubscribableError('tier is not active');
        const fee = tier.feeFor(dto.billingCycle as BillingCycle);
        if (fee == null) throw new TierNotSubscribableError(`tier has no ${dto.billingCycle} price`);
        return this.uow.run(tenantId, async (tx) => {
          if (await this.repo.findLiveForUser(tx, tenantId, userId)) throw new AlreadySubscribedError();
          const membership = UserMembership.subscribe({ id: uuidv7(), tenantId, userId, tierId: tier.id, billingCycle: dto.billingCycle as BillingCycle });
          if (fee > 0n) {
            await this.wallet.post(tx, { tenantId, txnType: 'subscription', idempotencyKey: `membership:${membership.id}`, referenceType: 'membership', referenceId: membership.id, initiatedBy: userId,
              legs: [{ account: userMain(userId), amountMinor: -fee }, { account: platform(PlatformAccount.Fees), amountMinor: fee }] });
          }
          await this.repo.insert(tx, membership);
          await this.flush(tx, tenantId, membership.id, membership.pullEvents());
          return this.serialize(membership, tier);
        }, { userId });
      }));
  }

  /** Renew self (extend the period + charge the wallet again for paid tiers). */
  async renew(tenantId: string, userId: string, id: string) {
    return timed(this.metrics, 'memberships.renew', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const membership = await this.repo.getForUpdate(tx, tenantId, id);
        if (!membership) throw new MembershipNotFoundError(id);
        if (membership.userId !== userId) throw new MembershipForbiddenError('only the member may renew');
        const tier = await this.tiers.getSubscribable(tenantId, membership.tierId);
        if (!tier) throw new TierNotFoundError(membership.tierId);
        const periodBefore = membership.currentPeriodEnd?.toISOString() ?? 'none';
        const fee = tier.feeFor(membership.toProps().billingCycle);
        if (fee && fee > 0n) {
          await this.wallet.post(tx, { tenantId, txnType: 'subscription', idempotencyKey: `membership-renew:${id}:${periodBefore}`, referenceType: 'membership', referenceId: id, initiatedBy: userId,
            legs: [{ account: userMain(userId), amountMinor: -fee }, { account: platform(PlatformAccount.Fees), amountMinor: fee }] });
        }
        membership.renew();
        await this.repo.update(tx, membership);
        await this.flush(tx, tenantId, id, membership.pullEvents());
        return this.serialize(membership, tier);
      }, { userId }));
  }

  async cancel(tenantId: string, actor: MembershipActor, id: string, ip: string | null) {
    return this.uow.run(tenantId, async (tx) => {
      const membership = await this.repo.getForUpdate(tx, tenantId, id);
      if (!membership) throw new MembershipNotFoundError(id);
      if (membership.userId !== actor.userId && !actor.canManage) throw new MembershipForbiddenError('only the member or an admin may cancel');
      membership.cancel();
      await this.repo.update(tx, membership);
      if (actor.canManage && membership.userId !== actor.userId) await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'membership.cancelled', entityType: 'user_membership', entityId: id, newValue: { by: 'admin' }, ip });
      await this.flush(tx, tenantId, id, membership.pullEvents());
      return this.serialize(membership, null);
    }, { userId: actor.userId });
  }

  /** Worker job: lapse a membership past its paid period. Idempotent (skips non-live / not-yet-due). */
  async expire(tenantId: string, id: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const membership = await this.repo.getForUpdate(tx, tenantId, id);
      if (!membership) return;
      if (!membership.expire(new Date())) return;
      await this.repo.update(tx, membership);
      await this.flush(tx, tenantId, id, membership.pullEvents());
    }, { userId: 'system' });
  }

  /** The caller's current live membership + the tier's benefits (or null). */
  async getMine(tenantId: string, userId: string) {
    const membership = await this.repo.findLiveForUser(null, tenantId, userId);
    if (!membership) return { membership: null };
    const tier = await this.tiers.getSubscribable(tenantId, membership.tierId);
    return { membership: this.serialize(membership, tier) };
  }

  async list(tenantId: string, actor: MembershipActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canManage) throw new MembershipForbiddenError('requires membership.manage');
    const rows = await this.repo.listFor(tenantId, { userId: q.box === 'mine' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((m) => this.serialize(m, null));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(m: UserMembership, tier: import('../domain/membership-tier.entity').MembershipTier | null) {
    const v = m.toProps();
    const benefits = tier ? (() => { const t = tier.toProps(); return { freeDelivery: t.benefits.freeDelivery, creditDays: t.benefits.creditDays, creditLimitMinor: t.benefits.creditLimitMinor?.toString() ?? null, platformFeeBpsOverride: t.platformFeeBpsOverride }; })() : undefined;
    return { id: v.id, userId: v.userId, tierId: v.tierId, status: v.status, billingCycle: v.billingCycle, currentPeriodEnd: v.currentPeriodEnd,
      hasBenefits: isLive(v.status), benefits, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, membershipId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'user_membership', aggregateId: membershipId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
