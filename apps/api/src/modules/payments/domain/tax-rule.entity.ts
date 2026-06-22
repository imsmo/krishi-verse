// modules/payments/domain/tax-rule.entity.ts · a statutory tax rule (0006 tax_rules): GST / 194-O TDS / cess as
// effective-dated DATA, per country, with an optional category override and a CGST/SGST split. GLOBAL platform
// master data (no tenant_id). Pure TS value object that validates the rate + split and projects to the
// TaxRuleValues the settlement calculator consumes. Money/thresholds are bigint minor units; rates are bps.
import { TaxRuleValues } from './commission-rule.entity';
import { InvalidTaxRuleError } from './commission.errors';

export interface TaxSplitBps { [component: string]: number; }   // e.g. { cgst: 900, sgst: 900 } in bps
export interface TaxRuleProps {
  id: string; countryCode: string; taxCode: string; categoryId: string | null; hsnPrefix: string | null;
  rateBps: number; thresholdMinor: bigint | null; split: TaxSplitBps; effectiveFrom: string; effectiveTo: string | null; isActive: boolean;
}

function assertRate(bps: number, label: string): number {
  if (!Number.isInteger(bps) || bps < 0 || bps > 100000) throw new InvalidTaxRuleError(`${label} must be an integer 0..100000 bps`);
  return bps;
}

export class TaxRule {
  private constructor(private p: TaxRuleProps) {}
  static create(input: TaxRuleProps): TaxRule {
    if (!/^[A-Z]{2}$/.test(input.countryCode)) throw new InvalidTaxRuleError('country_code must be ISO-3166 alpha-2');
    if (!input.taxCode || input.taxCode.length > 20) throw new InvalidTaxRuleError('tax_code required (≤20)');
    assertRate(input.rateBps, 'rate_bps');
    if (input.thresholdMinor != null && input.thresholdMinor < 0n) throw new InvalidTaxRuleError('threshold_minor must be ≥ 0');
    let sum = 0;
    for (const k of Object.keys(input.split)) sum += assertRate(input.split[k], `split.${k}`);
    if (Object.keys(input.split).length > 0 && sum !== input.rateBps) throw new InvalidTaxRuleError('split components must sum to rate_bps');
    return new TaxRule(input);
  }
  static rehydrate(p: TaxRuleProps): TaxRule { return new TaxRule(p); }

  /** Project to the minimal shape the settlement calculator consumes. */
  toValues(): TaxRuleValues { return { rateBps: this.p.rateBps, thresholdMinor: this.p.thresholdMinor }; }
  /** Does this rule bite at the given gross? (TDS only above its threshold; others always apply.) */
  appliesAt(grossMinor: bigint): boolean { return this.p.thresholdMinor == null || grossMinor >= this.p.thresholdMinor; }
  toProps(): Readonly<TaxRuleProps> { return Object.freeze({ ...this.p, split: { ...this.p.split } }); }
}
