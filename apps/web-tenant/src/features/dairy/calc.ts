// apps/web-tenant/src/features/dairy/calc.ts · PURE validators + a float-free price PREVIEW for the dairy MCC
// operator console. No framework, no I/O → unit-tested. The SERVER stays authoritative: it re-prices every
// collection with the rate card and computes all money itself (Law 2/11). This preview only mirrors that math
// so the counter operator sees an estimate before recording; if it ever diverged, the server value wins.
// Weight/fat/snf are decimal STRINGS scaled to integers (no float, ever); money is bigint minor-unit STRINGS.

export const ANIMAL_TYPES = ['cow', 'buffalo', 'mixed'] as const;
export const PRICING_MODELS = ['two_axis', 'fat_pooled', 'snf_pooled'] as const;
export const PAYMENT_CYCLES = ['daily', 'weekly', 'fortnightly', 'monthly'] as const;
export const MILK_SHIFTS = ['morning', 'evening'] as const;

const WEIGHT = /^\d{1,5}(\.\d{1,3})?$/;   // kg, ≤3 dp
const PCT = /^\d{1,2}(\.\d{1,2})?$/;      // %, ≤2 dp
const MINOR = /^\d{1,15}$/;               // non-negative integer minor units
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

/** Parse a validated decimal string into a scaled integer (e.g. "12.345",3 → 12345n). Throws on bad input. */
export function parseScaled(s: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('not a decimal');
  const [int, frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(int + fracPadded);
}

/** Banker-free half-up rounding division on bigints — byte-identical to the server's roundDiv. */
export function roundDiv(num: bigint, den: bigint): bigint { return (num + den / 2n) / den; }

export interface RateCardLike {
  pricingModel: (typeof PRICING_MODELS)[number];
  ratePerKgFatMinor: string | null;
  ratePerKgSnfMinor: string | null;
  baseRatePerLitreMinor: string | null;
}

/** EXACT price in minor units for one collection — mirrors MilkRateCard.priceMinor (float-free).
 *  Inputs are the validated decimal strings from the form. Returns a bigint minor-unit string. */
export function previewCollectionMinor(card: RateCardLike, weightKg: string, fatPct: string, snfPct: string): string {
  const weightMilliKg = parseScaled(weightKg, 3);
  const fatCentiPct = parseScaled(fatPct, 2);
  const snfCentiPct = parseScaled(snfPct, 2);
  let total = 0n;
  const fat = card.ratePerKgFatMinor ? BigInt(card.ratePerKgFatMinor) : 0n;
  const snf = card.ratePerKgSnfMinor ? BigInt(card.ratePerKgSnfMinor) : 0n;
  const base = card.baseRatePerLitreMinor ? BigInt(card.baseRatePerLitreMinor) : 0n;
  if ((card.pricingModel === 'two_axis' || card.pricingModel === 'fat_pooled') && fat > 0n)
    total += roundDiv(weightMilliKg * fatCentiPct * fat, 10_000_000n);
  if ((card.pricingModel === 'two_axis' || card.pricingModel === 'snf_pooled') && snf > 0n)
    total += roundDiv(weightMilliKg * snfCentiPct * snf, 10_000_000n);
  if (base > 0n) total += roundDiv(weightMilliKg * base, 1000n);
  return total.toString();
}

// ---- form validators (pre-flight only; the server re-validates with zod .strict) ----
export function validateCollection(input: { weightKg: string; fatPct: string; snfPct: string; collectedOn: string; shift: string }): string | null {
  if (!WEIGHT.test(input.weightKg) || parseScaled(input.weightKg, 3) <= 0n) return 'weight';
  if (!PCT.test(input.fatPct)) return 'fat';
  if (!PCT.test(input.snfPct)) return 'snf';
  if (!DATE.test(input.collectedOn)) return 'date';
  if (!MILK_SHIFTS.includes(input.shift as (typeof MILK_SHIFTS)[number])) return 'shift';
  return null;
}

export function validateRateCard(input: { animalType: string; pricingModel: string; ratePerKgFatMinor?: string; ratePerKgSnfMinor?: string; baseRatePerLitreMinor?: string; effectiveFrom: string }): string | null {
  if (!ANIMAL_TYPES.includes(input.animalType as (typeof ANIMAL_TYPES)[number])) return 'animalType';
  if (!PRICING_MODELS.includes(input.pricingModel as (typeof PRICING_MODELS)[number])) return 'pricingModel';
  for (const v of [input.ratePerKgFatMinor, input.ratePerKgSnfMinor, input.baseRatePerLitreMinor]) if (v && !MINOR.test(v)) return 'rate';
  // each pricing model needs at least the relevant rate present
  if (input.pricingModel === 'two_axis' && !(input.ratePerKgFatMinor || input.ratePerKgSnfMinor || input.baseRatePerLitreMinor)) return 'rate';
  if (input.pricingModel === 'fat_pooled' && !input.ratePerKgFatMinor && !input.baseRatePerLitreMinor) return 'rate';
  if (input.pricingModel === 'snf_pooled' && !input.ratePerKgSnfMinor && !input.baseRatePerLitreMinor) return 'rate';
  if (!DATE.test(input.effectiveFrom)) return 'effectiveFrom';
  return null;
}

export function validateMcc(input: { code: string; defaultName: string }): string | null {
  if (!CODE.test(input.code)) return 'code';
  if (input.defaultName.trim().length < 1 || input.defaultName.length > 150) return 'name';
  return null;
}

export function validateMembership(input: { farmerUserId: string; mccId: string; memberCode: string; paymentCycle: string }): string | null {
  const UUID = /^[0-9a-fA-F-]{36}$/;
  if (!UUID.test(input.farmerUserId)) return 'farmer';
  if (!UUID.test(input.mccId)) return 'mcc';
  if (input.memberCode.trim().length < 1 || input.memberCode.length > 40) return 'memberCode';
  if (!PAYMENT_CYCLES.includes(input.paymentCycle as (typeof PAYMENT_CYCLES)[number])) return 'cycle';
  return null;
}

/** A bill's status drives which operator action is offered next (mirrors milk-bill.state). */
export function nextBillActions(status: string): Array<'preview' | 'approve' | 'pay'> {
  switch (status) {
    case 'draft': return ['preview'];
    case 'previewed': return ['approve'];
    case 'disputed': return ['approve'];
    case 'approved': return ['pay'];
    default: return [];
  }
}
