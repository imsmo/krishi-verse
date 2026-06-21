// apps/admin-api/src/modules/plans-ops/services/plan-crud.service.ts · the plan CATALOGUE CRUD + lifecycle: create
// (always DRAFT — not sellable until published), publish / archive / reactivate (via the state machine, Law 5),
// and the reads (registry keyset, single + composition, change history). One ACID tx per write; every change
// writes a plan_changes row + an append-only audit_log row IN THE SAME TX (§4). Prices are bigint minor units
// (Law 2). "Never edit a live plan" — price/composition edits live in the pricing/assignment services and are
// refused on a published plan (version it instead).
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { PlansRepository, PlanListQuery, ChangeListQuery } from '../repositories/plans.repository';
import { Plan } from '../domain/plan.entity';
import { PlanNotFoundError } from '../domain/plans-ops.errors';
import { CreatePlanDto, UpdatePlanLifecycleDto } from '../dto/plans-ops.dto';

@Injectable()
export class PlanCrudService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: PlansRepository) {}

  async create(actor: AdminRequestContext, dto: CreatePlanDto) {
    // First version of this (code, country) is 1; if the code already exists for the country, the next version.
    const id = randomUUID();
    const nextVersion = (await this.repo.maxVersion(dto.code, dto.countryCode)) + 1;
    const plan = Plan.createDraft({
      id, code: dto.code, version: nextVersion, defaultName: dto.defaultName, countryCode: dto.countryCode, currencyCode: dto.currencyCode,
      monthlyPriceMinor: BigInt(dto.monthlyPriceMinor), annualPriceMinor: BigInt(dto.annualPriceMinor), setupFeeMinor: BigInt(dto.setupFeeMinor), isPublic: dto.isPublic,
    });
    return this.pool.withTx(async (client) => {
      const created = (await this.repo.insertPlan(client, plan, actor.userId)).toJSON();   // 409 on version conflict
      await this.repo.insertChange(client, { planId: id, action: 'created', oldValue: null, newValue: created, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'plans.created', entityType: 'plan', entityId: id,
        newValue: { code: dto.code, version: nextVersion, country: dto.countryCode, status: 'draft' }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return created;
    });
  }

  async updateLifecycle(actor: AdminRequestContext, id: string, dto: UpdatePlanLifecycleDto) {
    return this.pool.withTx(async (client) => {
      const plan = await this.repo.getPlanForUpdate(client, id);
      if (!plan) throw new PlanNotFoundError(id);
      const before = plan.status;
      const change = dto.action === 'publish' ? plan.publish() : dto.action === 'archive' ? plan.archive() : plan.reactivate();
      const p = plan.toProps();
      await this.repo.updateLifecycle(client, id, p.status, p.isActive, actor.userId);
      await this.repo.insertChange(client, { planId: id, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `plans.${change.action}`, entityType: 'plan', entityId: id,
        oldValue: { status: before }, newValue: { status: p.status }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return plan.toJSON();
    });
  }

  async list(q: PlanListQuery) {
    const items = (await this.repo.listPlans(q)).map((p) => p.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async get(id: string) {
    const plan = await this.repo.getPlan(id);
    if (!plan) throw new PlanNotFoundError(id);
    const composition = await this.repo.getComposition(id);
    return { ...plan.toJSON(), features: composition.features, limits: composition.limits };
  }

  async history(q: ChangeListQuery) {
    if (!(await this.repo.getPlan(q.planId))) throw new PlanNotFoundError(q.planId);
    const items = await this.repo.listChanges(q);
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
