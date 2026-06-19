// modules/dairy/domain/milk-rate-card.entity.ts · the milk_rate_cards aggregate + THE PRICING ENGINE.
// Quality-based milk pricing (PRD §19.4). Money is bigint minor units and the computation is FLOAT-FREE:
// weight/fat/snf arrive as SCALED INTEGERS (weight ×1000 = milli-kg; fat/snf ×100 = centi-percent) so the
// price is exact integer arithmetic — never floating point (Law: money correctness).
//   two_axis  : fatKg×rateFat + snfKg×rateSnf
//   fat_pooled: fatKg×rateFat
//   snf_pooled: snfKg×rateSnf
//   (+ base_rate_per_litre × weight, if a base rate is set — a flat floor on top of quality premiums)
// bonus_rules (premium/penalty slabs in jsonb) are DEFERRED (documented in README).
import { PricingModel, AnimalType } from './dairy.events';
import { InvalidRateCardError } from './dairy.errors';

/** Round-half-up integer division for positive bigints (banker-free, deterministic). */
function roundDiv(num: bigint, den: bigint): bigint { return (num + den / 2n) / den; }

export interface MilkRateCardProps {
  id: string;
  tenantId: string;
  defaultName: string;
  animalType: AnimalType;
  pricingModel: PricingModel;
  ratePerKgFatMinor: bigint | null;
  ratePerKgSnfMinor: bigint | null;
  baseRatePerLitreMinor: bigint | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt?: Date;
}

export class MilkRateCard {
  private constructor(private readonly props: MilkRateCardProps) {}

  static create(input: Omit<MilkRateCardProps, 'isActive' | 'createdAt'> & { isActive?: boolean }): MilkRateCard {
    const { pricingModel, ratePerKgFatMinor, ratePerKgSnfMinor, baseRatePerLitreMinor } = input;
    if ((pricingModel === 'two_axis' || pricingModel === 'fat_pooled') && (ratePerKgFatMinor == null || ratePerKgFatMinor <= 0n))
      throw new InvalidRateCardError('fat rate required (and positive) for this pricing model');
    if ((pricingModel === 'two_axis' || pricingModel === 'snf_pooled') && (ratePerKgSnfMinor == null || ratePerKgSnfMinor <= 0n))
      throw new InvalidRateCardError('snf rate required (and positive) for this pricing model');
    if (baseRatePerLitreMinor != null && baseRatePerLitreMinor < 0n) throw new InvalidRateCardError('base rate cannot be negative');
    return new MilkRateCard({ ...input, isActive: input.isActive ?? true });
  }
  static rehydrate(props: MilkRateCardProps): MilkRateCard { return new MilkRateCard(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get animalType() { return this.props.animalType; }
  toProps(): Readonly<MilkRateCardProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, defaultName: v.defaultName, animalType: v.animalType, pricingModel: v.pricingModel,
    ratePerKgFatMinor: v.ratePerKgFatMinor?.toString() ?? null, ratePerKgSnfMinor: v.ratePerKgSnfMinor?.toString() ?? null,
    baseRatePerLitreMinor: v.baseRatePerLitreMinor?.toString() ?? null, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, isActive: v.isActive }; }

  /** EXACT price in minor units for one collection. Inputs are scaled integers:
   *  weightMilliKg = kg×1000, fatCentiPct = fat%×100, snfCentiPct = snf%×100. No floating point. */
  priceMinor(weightMilliKg: bigint, fatCentiPct: bigint, snfCentiPct: bigint): bigint {
    const p = this.props;
    let total = 0n;
    // fatKg×rateFat = (weightMilliKg/1000) × (fatCentiPct/10000) × rateFat = weightMilliKg×fatCentiPct×rateFat / 1e7
    if ((p.pricingModel === 'two_axis' || p.pricingModel === 'fat_pooled') && p.ratePerKgFatMinor)
      total += roundDiv(weightMilliKg * fatCentiPct * p.ratePerKgFatMinor, 10_000_000n);
    if ((p.pricingModel === 'two_axis' || p.pricingModel === 'snf_pooled') && p.ratePerKgSnfMinor)
      total += roundDiv(weightMilliKg * snfCentiPct * p.ratePerKgSnfMinor, 10_000_000n);
    // base × weight (kg) = weightMilliKg × base / 1000
    if (p.baseRatePerLitreMinor) total += roundDiv(weightMilliKg * p.baseRatePerLitreMinor, 1000n);
    return total;
  }
}
