// modules/tenancy/services/plan.service.ts
// SaaS plan catalogue (GLOBAL). Create/pause are PLATFORM-ADMIN only (plan.manage = god-mode, Law 11) —
// a tenant can never mint or alter plans; it only browses public ones and subscribes. Every write: one
// ACID tx (UoW), outbox in-tx (Law 4), audit. No money here (plan prices are reference; SaaS billing is
// a separate, deferred flow). No optimistic-lock column → mutations lock the row FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Plan } from '../domain/plan.entity';
import { DomainEvent, TenancyEventType } from '../domain/tenancy.events';
import { PlanNotFoundError, PlanForbiddenError, PlanCodeExistsError } from '../domain/tenancy.errors';
import { PlanRepository } from '../repositories/plan.repository';
import { CreatePlanDto } from '../dto/create-plan.dto';

export interface TenancyActor { userId: string; tenantId: string; canManagePlans: boolean; canManageSub: boolean; }

@Injectable()
export class PlanService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: PlanRepository,
  ) {}

  async create(actor: TenancyActor, idemKey: string, dto: CreatePlanDto) {
    if (!actor.canManagePlans) throw new PlanForbiddenError();
    return this.idem.remember(idemKey, actor.userId, 'tenancy.plan_create', () =>
      timed(this.metrics, 'tenancy.plan_create', {}, async () => {
        const limits: Record<string, bigint> = {};
        for (const [k, v] of Object.entries(dto.limits ?? {})) limits[k] = BigInt(v);
        const plan = Plan.create({ id: uuidv7(), code: dto.code, version: dto.version, defaultName: dto.defaultName, countryCode: dto.countryCode.toUpperCase(), currencyCode: dto.currencyCode.toUpperCase(),
          monthlyPriceMinor: BigInt(dto.monthlyPriceMinor), annualPriceMinor: BigInt(dto.annualPriceMinor), setupFeeMinor: dto.setupFeeMinor ? BigInt(dto.setupFeeMinor) : 0n, isPublic: dto.isPublic, limits });
        return this.uow.run(actor.tenantId, async (tx) => {
          if (!(await this.repo.insert(tx, plan))) throw new PlanCodeExistsError();
          await this.audit.write(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'plan.created', entityType: 'plan', entityId: plan.id, newValue: { code: plan.toProps().code } });
          await this.flush(tx, actor.tenantId, plan.id, [{ type: TenancyEventType.PlanCreated, payload: { planId: plan.id, code: plan.toProps().code } }]);
          return this.serialize(plan);
        }, { userId: actor.userId });
      }));
  }

  async setActive(actor: TenancyActor, id: string, isActive: boolean, ip: string | null) {
    if (!actor.canManagePlans) throw new PlanForbiddenError();
    return this.uow.run(actor.tenantId, async (tx) => {
      const plan = await this.repo.getForUpdate(tx, id);
      if (!plan) throw new PlanNotFoundError(id);
      plan.setActive(isActive);
      await this.repo.update(tx, plan);
      await this.audit.write(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: isActive ? 'plan.activated' : 'plan.paused', entityType: 'plan', entityId: id, newValue: { isActive }, ip });
      await this.flush(tx, actor.tenantId, id, [{ type: TenancyEventType.PlanUpdated, payload: { planId: id, isActive } }]);
      return this.serialize(plan);
    }, { userId: actor.userId });
  }

  async getById(tenantId: string, id: string) {
    const plan = await this.repo.getById(tenantId, id);
    if (!plan) throw new PlanNotFoundError(id);
    return this.serialize(plan);
  }
  /** Non-admins see only public plans; platform admins see all. */
  async list(tenantId: string, actor: TenancyActor, q: { cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listFor(tenantId, { publicOnly: !actor.canManagePlans, cursor: q.cursor, limit: q.limit });
    const items = rows.map((p) => this.serialize(p));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(p: Plan) {
    const v = p.toProps();
    const limits: Record<string, string> = {}; for (const [k, val] of Object.entries(v.limits)) limits[k] = val.toString();
    return { id: v.id, code: v.code, version: v.version, defaultName: v.defaultName, countryCode: v.countryCode, currencyCode: v.currencyCode,
      monthlyPriceMinor: v.monthlyPriceMinor.toString(), annualPriceMinor: v.annualPriceMinor.toString(), setupFeeMinor: v.setupFeeMinor.toString(),
      isPublic: v.isPublic, isActive: v.isActive, limits, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, planId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'plan', aggregateId: planId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
