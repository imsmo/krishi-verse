// modules/promotions/services/coupon.service.ts
// Coupon admin (create/delete) + the VALIDATE (preview) and REDEEM (authoritative) use-cases. Redeem is
// the money-adjacent path: in ONE ACID tx it locks the coupon + its promotion FOR UPDATE, enforces the
// global cap (max_uses), the per-user cap (per_user_limit), and the promotion BUDGET — all fail CLOSED —
// then appends the immutable redemption (UNIQUE per coupon+order → idempotent) and increments
// uses/spend. NO wallet movement (a discount is a price reduction; the order's discount_minor is set by
// checkout when it calls redeem — that wiring is the documented integration point). Outbox in-tx (Law 4).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Coupon } from '../domain/coupon.entity';
import { CouponRedemption } from '../domain/coupon-redemption.entity';
import { DomainEvent, PromotionEventType } from '../domain/promotions.events';
import {
  PromotionNotFoundError, PromotionForbiddenError, CouponNotFoundError, CouponNotActiveError,
  CouponNotApplicableError, CouponUserLimitError, DuplicateRedemptionError, CouponCodeExistsError,
} from '../domain/promotions.errors';
import { PromotionRepository } from '../repositories/promotion.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';
import { CreateCouponDto } from '../dto/create-coupon.dto';

export interface PromotionActor { userId: string; canManage: boolean; }

@Injectable()
export class CouponService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly promos: PromotionRepository,
    private readonly coupons: CouponRepository,
    private readonly redemptions: CouponRedemptionRepository,
  ) {}

  // ---------- admin ----------
  async createCoupon(tenantId: string, actor: PromotionActor, idemKey: string, dto: CreateCouponDto) {
    if (!actor.canManage) throw new PromotionForbiddenError('requires promotion.manage');
    return this.idem.remember(idemKey, actor.userId, 'promotions.coupon_create', () =>
      timed(this.metrics, 'promotions.coupon_create', { tenant: tenantId }, async () => {
        const promo = await this.promos.getById(tenantId, dto.promotionId);
        if (!promo) throw new PromotionNotFoundError(dto.promotionId);
        const coupon = Coupon.create({ id: uuidv7(), tenantId, promotionId: dto.promotionId, code: dto.code, maxUses: dto.maxUses ?? null, perUserLimit: dto.perUserLimit });
        return this.uow.run(tenantId, async (tx) => {
          const inserted = await this.coupons.insert(tx, coupon);
          if (!inserted) throw new CouponCodeExistsError();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'coupon.created', entityType: 'coupon', entityId: coupon.id, newValue: { code: coupon.code, promotionId: dto.promotionId } });
          await this.outbox.write(tx, { tenantId, aggregateType: 'coupon', aggregateId: coupon.id, eventType: PromotionEventType.CouponCreated, payload: { v: 1, couponId: coupon.id, promotionId: dto.promotionId } });
          return { id: coupon.id, code: coupon.code, promotionId: dto.promotionId, perUserLimit: coupon.perUserLimit };
        }, { userId: actor.userId });
      }));
  }

  async deleteCoupon(tenantId: string, actor: PromotionActor, id: string, ip: string | null) {
    if (!actor.canManage) throw new PromotionForbiddenError('requires promotion.manage');
    return this.uow.run(tenantId, async (tx) => {
      await this.coupons.softDelete(tx, tenantId, id);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'coupon.deleted', entityType: 'coupon', entityId: id, newValue: {}, ip });
      return { id, deleted: true };
    }, { userId: actor.userId });
  }

  async listForPromotion(tenantId: string, actor: PromotionActor, promotionId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    if (!actor.canManage) throw new PromotionForbiddenError('requires promotion.manage');
    const rows = await this.coupons.listForPromotion(tenantId, promotionId, q);
    const items = rows.map((c) => { const v = c.toProps(); return { id: v.id, code: v.code, maxUses: v.maxUses, uses: v.uses, perUserLimit: v.perUserLimit, createdAt: v.createdAt }; });
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  // ---------- preview (read-only) ----------
  async validate(tenantId: string, code: string, subtotalMinor: bigint) {
    const coupon = await this.coupons.getByCode(tenantId, code);
    if (!coupon) throw new CouponNotFoundError();
    const promo = await this.promos.getById(tenantId, coupon.promotionId);
    if (!promo) throw new CouponNotFoundError();
    if (!promo.isRedeemableNow()) throw new CouponNotActiveError(promo.status());
    if (!coupon.hasGlobalCapacity()) throw new CouponNotActiveError('exhausted');
    const discountMinor = promo.computeDiscount(subtotalMinor);
    if (discountMinor <= 0n) throw new CouponNotApplicableError();
    return { code: coupon.code, promotionId: coupon.promotionId, discountMinor: discountMinor.toString() };
  }

  // ---------- authoritative redemption (atomic) ----------
  async redeem(tenantId: string, userId: string, idemKey: string, dto: { code: string; orderId: string; subtotalMinor: bigint }) {
    return this.idem.remember(idemKey, userId, 'promotions.redeem', () =>
      timed(this.metrics, 'promotions.redeem', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const coupon = await this.coupons.getByCodeForUpdate(tx, tenantId, dto.code);
          if (!coupon) throw new CouponNotFoundError();
          const promo = await this.promos.getForUpdate(tx, tenantId, coupon.promotionId);
          if (!promo) throw new PromotionNotFoundError(coupon.promotionId);
          if (!promo.isRedeemableNow()) throw new CouponNotActiveError(promo.status());
          const discount = promo.computeDiscount(dto.subtotalMinor);
          if (discount <= 0n) throw new CouponNotApplicableError();

          // per-user cap (counted in-tx under the coupon lock)
          const used = await this.redemptions.countForUser(tx, tenantId, coupon.id, userId);
          if (used >= coupon.perUserLimit) throw new CouponUserLimitError();

          // append the immutable redemption FIRST (idempotent per coupon+order)
          const redemption = CouponRedemption.create({ id: uuidv7(), couponId: coupon.id, tenantId, userId, orderId: dto.orderId, amountMinor: discount });
          if (!(await this.redemptions.insert(tx, redemption))) throw new DuplicateRedemptionError();

          // consume the global cap + the promotion budget (both fail CLOSED), then persist
          coupon.consumeUse();
          promo.recordSpend(discount);
          await this.coupons.updateUses(tx, coupon);
          await this.promos.update(tx, promo);

          await this.flush(tx, tenantId, coupon.id, [
            { type: PromotionEventType.CouponRedeemed, payload: { couponId: coupon.id, promotionId: promo.id, orderId: dto.orderId, userId, discountMinor: discount.toString() } },
            ...promo.pullEvents(),
          ]);
          return { code: coupon.code, promotionId: promo.id, orderId: dto.orderId, discountMinor: discount.toString() };
        }, { userId })));
  }

  async listMyRedemptions(tenantId: string, userId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const items = await this.redemptions.listForUser(tenantId, userId, q);
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async flush(tx: TxContext, tenantId: string, aggId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'coupon', aggregateId: aggId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
