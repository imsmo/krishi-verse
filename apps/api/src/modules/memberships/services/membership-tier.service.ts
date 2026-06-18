// modules/memberships/services/membership-tier.service.ts
// Membership-tier admin (create/pause) + public browse. Tier CRUD needs membership.manage and is ALWAYS
// tenant-scoped (a tenant cannot create/mutate a platform-standard NULL tier — Law 11). Every write: one
// ACID tx (UoW), outbox in-tx (Law 4), audit on admin actions. No money here. No version → FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { MembershipTier, parseBenefits } from '../domain/membership-tier.entity';
import { DomainEvent, MembershipEventType } from '../domain/memberships.events';
import { TierNotFoundError, MembershipForbiddenError, TierCodeExistsError } from '../domain/memberships.errors';
import { MembershipTierRepository } from '../repositories/membership-tier.repository';
import { CreateTierDto } from '../dto/create-membership-tier.dto';

export interface MembershipActor { userId: string; canManage: boolean; }

@Injectable()
export class MembershipTierService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: MembershipTierRepository,
  ) {}

  async create(tenantId: string, actor: MembershipActor, idemKey: string, dto: CreateTierDto) {
    if (!actor.canManage) throw new MembershipForbiddenError('requires membership.manage');
    return this.idem.remember(idemKey, actor.userId, 'memberships.tier_create', () =>
      timed(this.metrics, 'memberships.tier_create', { tenant: tenantId }, async () => {
        const tier = MembershipTier.create({ id: uuidv7(), tenantId, code: dto.code, defaultName: dto.defaultName, audienceRoleId: dto.audienceRoleId ?? null,
          monthlyFeeMinor: BigInt(dto.monthlyFeeMinor), annualFeeMinor: dto.annualFeeMinor ? BigInt(dto.annualFeeMinor) : null, currencyCode: dto.currencyCode ?? 'INR',
          platformFeeBpsOverride: dto.platformFeeBpsOverride ?? null, benefits: parseBenefits(dto.benefits ?? {}) });
        return this.uow.run(tenantId, async (tx) => {
          if (!(await this.repo.insert(tx, tier))) throw new TierCodeExistsError();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'membership.tier_created', entityType: 'membership_tier', entityId: tier.id, newValue: { code: tier.toProps().code } });
          await this.flush(tx, tenantId, tier.id, [{ type: MembershipEventType.TierCreated, payload: { tierId: tier.id, code: tier.toProps().code } }]);
          return this.serialize(tier);
        }, { userId: actor.userId });
      }));
  }

  async setActive(tenantId: string, actor: MembershipActor, id: string, isActive: boolean, ip: string | null) {
    if (!actor.canManage) throw new MembershipForbiddenError('requires membership.manage');
    return this.uow.run(tenantId, async (tx) => {
      const tier = await this.repo.getForUpdate(tx, tenantId, id);
      if (!tier) throw new TierNotFoundError(id);   // 404 also covers global tiers (not tenant-owned → not mutable)
      tier.setActive(isActive);
      await this.repo.update(tx, tier);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: isActive ? 'membership.tier_activated' : 'membership.tier_paused', entityType: 'membership_tier', entityId: id, newValue: { isActive }, ip });
      await this.flush(tx, tenantId, id, [{ type: MembershipEventType.TierUpdated, payload: { tierId: id, isActive } }]);
      return this.serialize(tier);
    }, { userId: actor.userId });
  }

  /** Public-within-tenant: browse the tenant's + platform-standard tiers (to subscribe). */
  async getById(tenantId: string, id: string) {
    const tier = await this.repo.getSubscribable(tenantId, id);
    if (!tier) throw new TierNotFoundError(id);
    return this.serialize(tier);
  }
  async list(tenantId: string, q: { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((t) => this.serialize(t));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(t: MembershipTier) {
    const v = t.toProps();
    return { id: v.id, tenantId: v.tenantId, code: v.code, defaultName: v.defaultName, monthlyFeeMinor: v.monthlyFeeMinor.toString(),
      annualFeeMinor: v.annualFeeMinor?.toString() ?? null, currencyCode: v.currencyCode, platformFeeBpsOverride: v.platformFeeBpsOverride,
      benefits: { freeDelivery: v.benefits.freeDelivery, creditDays: v.benefits.creditDays, creditLimitMinor: v.benefits.creditLimitMinor?.toString() ?? null },
      isActive: v.isActive, isPlatformStandard: v.tenantId === null, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, tierId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'membership_tier', aggregateId: tierId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
