// modules/catalogue/domain/regulated-rule.entity.ts · a regulated-input compliance rule (pesticides/pharma —
// PRD §9.10) applying to a product OR a category branch, optionally region-scoped + time-bounded. Pure read model
// in the tenant plane (GLOBAL master, no tenant_id — WRITTEN in apps/admin-api, Law 11). `isEffective` +
// `appliesToRegion` are pure so listing-time enforcement (Phase-2 hook) can be unit-tested.
export const RULE_TYPES = ['banned_state', 'prescription_required', 'license_required', 'safety_label'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export interface RegulatedRuleProps {
  id: string; productId: string | null; categoryId: string | null; ruleType: RuleType | string;
  regionId: string | null; payload: Record<string, unknown>; effectiveFrom: string; effectiveTo: string | null;
}

export class RegulatedRule {
  constructor(readonly props: RegulatedRuleProps) {}
  get id() { return this.props.id; }

  /** In its effective window as of `asOf` (effective_from inclusive; effective_to inclusive if set). */
  isEffective(asOf: Date = new Date()): boolean {
    const day = asOf.toISOString().slice(0, 10);
    if (this.props.effectiveFrom > day) return false;
    if (this.props.effectiveTo != null && this.props.effectiveTo < day) return false;
    return true;
  }

  /** A national rule (region_id NULL) applies everywhere; a region-scoped rule only in that region. */
  appliesToRegion(regionId: string | null): boolean {
    return this.props.regionId == null || this.props.regionId === regionId;
  }

  toJSON() {
    return { id: this.props.id, productId: this.props.productId, categoryId: this.props.categoryId, ruleType: this.props.ruleType, regionId: this.props.regionId, payload: this.props.payload, effectiveFrom: this.props.effectiveFrom, effectiveTo: this.props.effectiveTo };
  }
}
