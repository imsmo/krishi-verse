// apps/admin-api/src/modules/plans-ops/services/plan-assignment.service.ts · assigns CAPABILITIES to a plan: the
// plan_features (what's included + per-plan config) and plan_limits (the dynamic quotas QuotaService resolves).
// Composition is editable ONLY while the plan is DRAFT — once published it is immutable (grandfathering: existing
// subscribers' entitlements must not shift under them); change a live plan by versioning it. A feature code must
// exist in the platform feature catalogue (FK-safe → typed 404). One ACID tx per write; plan_changes + audit_log
// rows IN THE SAME TX (§4). Limit values are bigint (-1 = unlimited), never float.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { PlansRepository } from '../repositories/plans.repository';
import { Plan } from '../domain/plan.entity';
import { assertFeatureCode, assertLimitCode, assertLimitValue } from '../domain/plan.entity';
import { PlanNotFoundError, PlanImmutableError, FeatureNotFoundError } from '../domain/plans-ops.errors';
import { SetFeatureDto, SetLimitDto } from '../dto/plans-ops.dto';

@Injectable()
export class PlanAssignmentService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: PlansRepository) {}

  private assertDraft(plan: Plan): void {
    if (plan.status !== 'draft') throw new PlanImmutableError('composition of a published/archived plan is immutable; create a new version');
  }

  async setFeature(actor: AdminRequestContext, planId: string, featureCode: string, dto: SetFeatureDto) {
    const code = assertFeatureCode(featureCode);
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, planId);
      if (!plan) throw new PlanNotFoundError(planId);
      this.assertDraft(plan);
      if (!(await this.repo.featureExists(code))) throw new FeatureNotFoundError(code);
      await this.repo.upsertFeature(client, planId, code, dto.isIncluded, dto.config ?? {});
      const newValue = { featureCode: code, isIncluded: dto.isIncluded };
      await this.repo.insertChange(client, { planId, action: 'feature_set', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.feature_set', entityType: 'plan', entityId: planId, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { planId, ...newValue };
    });
  }

  async removeFeature(actor: AdminRequestContext, planId: string, featureCode: string, reason: string) {
    const code = assertFeatureCode(featureCode);
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, planId);
      if (!plan) throw new PlanNotFoundError(planId);
      this.assertDraft(plan);
      await this.repo.removeFeature(client, planId, code);
      await this.repo.insertChange(client, { planId, action: 'feature_removed', oldValue: { featureCode: code }, newValue: null, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.feature_removed', entityType: 'plan', entityId: planId, oldValue: { featureCode: code }, reason, ip: actor.ip, requestId: actor.requestId || null });
      return { planId, featureCode: code, removed: true };
    });
  }

  async setLimit(actor: AdminRequestContext, planId: string, limitCode: string, dto: SetLimitDto) {
    const code = assertLimitCode(limitCode);
    const value = assertLimitValue(BigInt(dto.limitValue));
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, planId);
      if (!plan) throw new PlanNotFoundError(planId);
      this.assertDraft(plan);
      await this.repo.upsertLimit(client, planId, code, value);
      const newValue = { limitCode: code, limitValue: value.toString() };
      await this.repo.insertChange(client, { planId, action: 'limit_set', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.limit_set', entityType: 'plan', entityId: planId, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { planId, ...newValue };
    });
  }

  async removeLimit(actor: AdminRequestContext, planId: string, limitCode: string, reason: string) {
    const code = assertLimitCode(limitCode);
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, planId);
      if (!plan) throw new PlanNotFoundError(planId);
      this.assertDraft(plan);
      await this.repo.removeLimit(client, planId, code);
      await this.repo.insertChange(client, { planId, action: 'limit_removed', oldValue: { limitCode: code }, newValue: null, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.limit_removed', entityType: 'plan', entityId: planId, oldValue: { limitCode: code }, reason, ip: actor.ip, requestId: actor.requestId || null });
      return { planId, limitCode: code, removed: true };
    });
  }

  /** Read-only: the platform feature catalogue (valid feature codes to assign). */
  async featureCatalogue() {
    return { items: await this.repo.listFeatureCatalogue() };
  }
}
