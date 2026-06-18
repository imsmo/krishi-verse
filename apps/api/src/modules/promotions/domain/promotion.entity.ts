// modules/promotions/domain/promotion.entity.ts
// Promotion aggregate — a budgeted campaign whose `rules` jsonb defines a coupon discount. Pure domain:
// money (budget/spent/discount) in bigint minor units; NO wallet movement (a discount is a price
// reduction; spent_minor is promo ACCOUNTING). No version column (add_std_columns) → the service
// serializes budget mutations with SELECT … FOR UPDATE. Validity (window/active/budget) lives in
// promotion.state (Law 5). `rules` is parsed/validated on the way IN, never trusted as freeform.
import { derivePromotionStatus, isRedeemable, PromotionStatus } from './promotion.state';
import { PromotionEventType, DomainEvent, DiscountType } from './promotions.events';
import { InvalidPromotionError, PromotionBudgetExceededError } from './promotions.errors';

export interface PromoRules {
  discountType: DiscountType;
  percentOff: number | null;        // 1..100 when discountType='percent'
  amountOffMinor: bigint | null;    // when discountType='flat'
  minOrderMinor: bigint | null;     // eligibility floor
  maxDiscountMinor: bigint | null;  // cap (percent)
}
export interface PromotionProps {
  id: string; tenantId: string; promoType: string; defaultName: string; rules: PromoRules;
  budgetMinor: bigint | null; spentMinor: bigint; startsAt: Date; endsAt: Date; isActive: boolean; createdAt: Date;
}

/** Parse + VALIDATE the freeform rules jsonb into a typed, bounded PromoRules (no ReDoS, no junk). */
export function parsePromoRules(raw: any): PromoRules {
  const type = raw?.discountType;
  if (type !== 'percent' && type !== 'flat') throw new InvalidPromotionError('rules.discountType must be percent|flat');
  const big = (v: any, name: string): bigint | null => {
    if (v == null) return null;
    if (typeof v !== 'string' || !/^\d{1,16}$/.test(v)) throw new InvalidPromotionError(`rules.${name} must be a non-negative integer string of minor units`);
    return BigInt(v);
  };
  let percentOff: number | null = null; let amountOffMinor: bigint | null = null;
  if (type === 'percent') {
    const po = raw.percentOff;
    if (!Number.isInteger(po) || po < 1 || po > 100) throw new InvalidPromotionError('rules.percentOff must be an integer 1..100');
    percentOff = po as number;
  } else {
    amountOffMinor = big(raw.amountOffMinor, 'amountOffMinor');
    if (amountOffMinor == null || amountOffMinor <= 0n) throw new InvalidPromotionError('rules.amountOffMinor must be a positive minor amount');
  }
  return { discountType: type, percentOff, amountOffMinor, minOrderMinor: big(raw.minOrderMinor, 'minOrderMinor'), maxDiscountMinor: big(raw.maxDiscountMinor, 'maxDiscountMinor') };
}

export class Promotion {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: PromotionProps) {}

  static create(input: { id: string; tenantId: string; promoType: string; defaultName: string; rules: PromoRules; budgetMinor?: bigint | null; startsAt: Date; endsAt: Date; now?: Date }): Promotion {
    if (!input.defaultName?.trim()) throw new InvalidPromotionError('name is required');
    if (input.endsAt.getTime() <= input.startsAt.getTime()) throw new InvalidPromotionError('endsAt must be after startsAt');
    if (input.budgetMinor != null && input.budgetMinor < 0n) throw new InvalidPromotionError('budget cannot be negative');
    const p = new Promotion({ id: input.id, tenantId: input.tenantId, promoType: input.promoType, defaultName: input.defaultName.trim(),
      rules: input.rules, budgetMinor: input.budgetMinor ?? null, spentMinor: 0n, startsAt: input.startsAt, endsAt: input.endsAt, isActive: true, createdAt: input.now ?? new Date() });
    p.events.push({ type: PromotionEventType.PromotionCreated, payload: { promotionId: p.props.id, promoType: p.props.promoType } });
    return p;
  }
  static rehydrate(props: PromotionProps): Promotion { return new Promotion(props); }

  get id() { return this.props.id; }
  get isActive() { return this.props.isActive; }
  get spentMinor() { return this.props.spentMinor; }
  get budgetMinor() { return this.props.budgetMinor; }
  status(now: Date = new Date()): PromotionStatus { return derivePromotionStatus(this.props, now); }
  isRedeemableNow(now: Date = new Date()): boolean { return isRedeemable(this.props, now); }
  toProps(): Readonly<PromotionProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  setActive(active: boolean): void {
    this.props.isActive = active;
    this.events.push({ type: PromotionEventType.PromotionUpdated, payload: { promotionId: this.props.id, isActive: active } });
  }

  /** The discount this promotion grants on `subtotalMinor` (0 if below the minimum or it computes to 0). */
  computeDiscount(subtotalMinor: bigint): bigint {
    if (subtotalMinor <= 0n) return 0n;
    if (this.props.rules.minOrderMinor != null && subtotalMinor < this.props.rules.minOrderMinor) return 0n;
    let disc: bigint;
    if (this.props.rules.discountType === 'percent') {
      disc = (subtotalMinor * BigInt(this.props.rules.percentOff!)) / 100n;
      if (this.props.rules.maxDiscountMinor != null && disc > this.props.rules.maxDiscountMinor) disc = this.props.rules.maxDiscountMinor;
    } else {
      disc = this.props.rules.amountOffMinor!;
    }
    if (disc > subtotalMinor) disc = subtotalMinor;       // never below zero total
    return disc < 0n ? 0n : disc;
  }

  /** Record promotional spend against the budget (fail CLOSED if it would exceed it). */
  recordSpend(amountMinor: bigint): void {
    if (amountMinor <= 0n) return;
    if (this.props.budgetMinor != null && this.props.spentMinor + amountMinor > this.props.budgetMinor) throw new PromotionBudgetExceededError();
    this.props.spentMinor += amountMinor;
    if (this.props.budgetMinor != null && this.props.spentMinor >= this.props.budgetMinor) this.events.push({ type: PromotionEventType.BudgetExhausted, payload: { promotionId: this.props.id } });
  }
}
