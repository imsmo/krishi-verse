// modules/promotions/services/promotion.service.ts
// Promotion admin use-cases (tenant_admin / promotion.manage). Every write: one ACID tx (UoW), outbox
// events in the SAME tx (Law 4), audit on every admin action. NO money moves here — a promotion's
// budget/spent is promo ACCOUNTING (a discount is a price reduction, not a wallet txn). No version
// column → budget/active mutations lock the row FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Promotion, parsePromoRules } from '../domain/promotion.entity';
import { DomainEvent } from '../domain/promotions.events';
import { PromotionNotFoundError, PromotionForbiddenError } from '../domain/promotions.errors';
import { PromotionRepository } from '../repositories/promotion.repository';
import { CreatePromotionDto } from '../dto/create-promotion.dto';

export interface PromotionActor { userId: string; canManage: boolean; }

@Injectable()
export class PromotionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: PromotionRepository,
  ) {}

  async create(tenantId: string, actor: PromotionActor, idemKey: string, dto: CreatePromotionDto) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'promotions.create', () =>
      timed(this.metrics, 'promotions.create', { tenant: tenantId }, async () => {
        const rules = parsePromoRules(dto.rules);   // defense-in-depth (also validated by zod at the edge)
        const promo = Promotion.create({ id: uuidv7(), tenantId, promoType: dto.promoType, defaultName: dto.defaultName, rules,
          budgetMinor: dto.budgetMinor ? BigInt(dto.budgetMinor) : null, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, promo);
          const p = promo.toProps();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'promotion.created', entityType: 'promotion', entityId: p.id, newValue: { promoType: p.promoType } });
          await this.flush(tx, tenantId, p.id, promo.pullEvents());
          return this.serialize(promo);
        }, { userId: actor.userId });
      }));
  }

  async setActive(tenantId: string, actor: PromotionActor, id: string, isActive: boolean, ip: string | null) {
    this.assertManager(actor);
    return this.uow.run(tenantId, async (tx) => {
      const promo = await this.repo.getForUpdate(tx, tenantId, id);
      if (!promo) throw new PromotionNotFoundError(id);
      promo.setActive(isActive);
      await this.repo.update(tx, promo);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: isActive ? 'promotion.activated' : 'promotion.paused', entityType: 'promotion', entityId: id, newValue: { isActive }, ip });
      await this.flush(tx, tenantId, id, promo.pullEvents());
      return this.serialize(promo);
    }, { userId: actor.userId });
  }

  async getById(tenantId: string, actor: PromotionActor, id: string) {
    this.assertManager(actor);
    const promo = await this.repo.getById(tenantId, id);
    if (!promo) throw new PromotionNotFoundError(id);
    return this.serialize(promo);
  }

  async list(tenantId: string, actor: PromotionActor, q: { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    this.assertManager(actor);
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((p) => this.serialize(p));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  // ---------- system (worker-job) lifecycle — no actor, called per-tenant by the worker jobs ----------
  /** promo-budget-watch job: deactivate a promotion that has burned through its budget. Idempotent
   *  (no-op if already inactive or not yet exhausted). Emits PromotionUpdated (+ BudgetExhausted if it
   *  crossed exactly now). FOR UPDATE-locked. */
  async deactivateExhausted(tenantId: string, id: string): Promise<{ deactivated: boolean }> {
    return this.uow.run(tenantId, async (tx) => {
      const promo = await this.repo.getForUpdate(tx, tenantId, id);
      if (!promo || !promo.isActive || !promo.isBudgetExhausted()) return { deactivated: false };
      promo.setActive(false);
      await this.repo.update(tx, promo);
      await this.flush(tx, tenantId, id, promo.pullEvents());
      this.metrics.inc('promotions.budget_deactivated', { tenant: tenantId });
      return { deactivated: true };
    }, { userId: 'system' });
  }

  /** festival-campaign-scheduler job: align a (festival) promotion's is_active with its [starts_at,ends_at]
   *  window — activate when it opens, pause when it closes. Idempotent (no-op when already aligned). */
  async applyScheduleWindow(tenantId: string, id: string, now = new Date()): Promise<{ changed: boolean }> {
    return this.uow.run(tenantId, async (tx) => {
      const promo = await this.repo.getForUpdate(tx, tenantId, id);
      if (!promo) return { changed: false };
      const desired = promo.isWithinWindow(now) && !promo.isBudgetExhausted();
      if (promo.isActive === desired) return { changed: false };
      promo.setActive(desired);
      await this.repo.update(tx, promo);
      await this.flush(tx, tenantId, id, promo.pullEvents());
      this.metrics.inc('promotions.schedule_toggled', { tenant: tenantId, active: String(desired) });
      return { changed: true };
    }, { userId: 'system' });
  }

  private assertManager(actor: PromotionActor): void { if (!actor.canManage) throw new PromotionForbiddenError('requires promotion.manage'); }
  private serialize(p: Promotion) {
    const v = p.toProps();
    return { id: v.id, promoType: v.promoType, defaultName: v.defaultName, status: p.status(), rules: { discountType: v.rules.discountType, percentOff: v.rules.percentOff, amountOffMinor: v.rules.amountOffMinor?.toString() ?? null, minOrderMinor: v.rules.minOrderMinor?.toString() ?? null, maxDiscountMinor: v.rules.maxDiscountMinor?.toString() ?? null },
      budgetMinor: v.budgetMinor?.toString() ?? null, spentMinor: v.spentMinor.toString(), startsAt: v.startsAt, endsAt: v.endsAt, isActive: v.isActive, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, promotionId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'promotion', aggregateId: promotionId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
