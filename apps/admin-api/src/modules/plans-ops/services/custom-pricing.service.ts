// apps/admin-api/src/modules/plans-ops/services/custom-pricing.service.ts · PRICING + VERSIONING (anchor/enterprise
// deals). setPrices edits a DRAFT plan's prices (a published plan is immutable — Law: grandfathering). version()
// is the "never edit a live plan" path: it CLONES a published plan into a new DRAFT version (version+1) with new
// prices + its features/limits copied, leaving existing subscriptions on the old version untouched; mark it
// is_public=false for a private/custom (anchor) plan. setVisibility toggles public/custom at any status. One ACID
// tx per write; every change writes a plan_changes row + audit_log row IN THE SAME TX (§4). Money is bigint (Law 2).
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { PlansRepository } from '../repositories/plans.repository';
import { Plan } from '../domain/plan.entity';
import { PlanNotFoundError } from '../domain/plans-ops.errors';
import { SetPricingDto, VersionPlanDto } from '../dto/plans-ops.dto';

@Injectable()
export class CustomPricingService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: PlansRepository) {}

  async setPrices(actor: AdminRequestContext, id: string, dto: SetPricingDto) {
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, id);
      if (!plan) throw new PlanNotFoundError(id);
      const change = plan.setPrices(BigInt(dto.monthlyPriceMinor), BigInt(dto.annualPriceMinor), BigInt(dto.setupFeeMinor));  // throws PlanImmutableError if not draft
      await this.repo.updatePricing(client, id, BigInt(dto.monthlyPriceMinor), BigInt(dto.annualPriceMinor), BigInt(dto.setupFeeMinor), actor.userId);
      await this.repo.insertChange(client, { planId: id, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.price_changed', entityType: 'plan', entityId: id, oldValue: change.oldValue, newValue: change.newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return plan.toJSON();
    });
  }

  /** Clone a plan into a new DRAFT version with new prices (grandfathering — existing subs keep their version). */
  async version(actor: AdminRequestContext, sourceId: string, dto: VersionPlanDto) {
    return this.pool.withTx(async (client) => {
      const src = await this.repo.getPlanForUpdate(client, sourceId);   // lock the source so concurrent versioning serialises
      if (!src) throw new PlanNotFoundError(sourceId);
      const s = src.toProps();
      const newId = randomUUID();
      const nextVersion = (await this.repo.maxVersion(s.code, s.countryCode)) + 1;
      const draft = Plan.createDraft({
        id: newId, code: s.code, version: nextVersion, defaultName: s.defaultName, countryCode: s.countryCode, currencyCode: s.currencyCode,
        monthlyPriceMinor: BigInt(dto.monthlyPriceMinor), annualPriceMinor: BigInt(dto.annualPriceMinor), setupFeeMinor: BigInt(dto.setupFeeMinor),
        isPublic: dto.isPublic ?? s.isPublic,
      });
      const created = (await this.repo.insertPlan(client, draft, actor.userId)).toJSON();   // 409 on version conflict
      await this.repo.cloneComposition(client, sourceId, newId);                            // copy features + limits
      await this.repo.insertChange(client, { planId: newId, action: 'versioned', oldValue: { fromPlanId: sourceId, fromVersion: s.version }, newValue: created, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.versioned', entityType: 'plan', entityId: newId,
        oldValue: { fromPlanId: sourceId, fromVersion: s.version }, newValue: { code: s.code, version: nextVersion, country: s.countryCode }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return created;
    });
  }

  async setVisibility(actor: AdminRequestContext, id: string, isPublic: boolean, reason: string) {
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, id);
      if (!plan) throw new PlanNotFoundError(id);
      const change = plan.setVisibility(isPublic);
      await this.repo.updateVisibility(client, id, isPublic, actor.userId);
      await this.repo.insertChange(client, { planId: id, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.visibility_changed', entityType: 'plan', entityId: id, oldValue: change.oldValue, newValue: change.newValue, reason, ip: actor.ip, requestId: actor.requestId || null });
      return plan.toJSON();
    });
  }
}
