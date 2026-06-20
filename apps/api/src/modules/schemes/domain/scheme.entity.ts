// modules/schemes/domain/scheme.entity.ts · read-only VO for schemes + the ELIGIBILITY EVALUATOR.
// GLOBAL catalogue (no tenant_id): 200+ govt schemes as DATA. benefit_summary / eligibility_rules are
// machine-readable jsonb. processing_fee_minor is bigint minor units (Law 2). Rules are versioned (a change
// bumps `version`); applications snapshot the version they were filed under. Admin-authored (Law 11).
import { ApplicantProfile } from './schemes.events';

export interface SchemeProps {
  id: string; code: string; defaultName: string; authorityId: string; categoryId: string;
  benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>; requiredDocTypeIds: string[];
  applicationWindow: Record<string, unknown> | null; applicableRegionIds: string[]; processingFeeMinor: bigint; version: number; isActive: boolean; createdAt?: Date;
}
export interface EligibilityResult { eligible: boolean; reasons: string[]; }

export class Scheme {
  private constructor(private readonly props: SchemeProps) {}
  static rehydrate(p: SchemeProps): Scheme { return new Scheme(p); }
  get id() { return this.props.id; }
  get code() { return this.props.code; }
  get version() { return this.props.version; }
  get processingFeeMinor() { return this.props.processingFeeMinor; }
  get isActive() { return this.props.isActive; }

  /** Deterministic, explainable eligibility check (PRD right-to-explanation): evaluate the applicant's
   *  attributes against the scheme's machine-readable rules. Unknown rule keys are ignored (forward-safe).
   *  The richer rule DSL + AI confidence are deferred. */
  evaluate(profile: ApplicantProfile): EligibilityResult {
    const r = this.props.eligibilityRules as any; const reasons: string[] = [];
    if (Array.isArray(r.roles) && r.roles.length > 0) {
      const has = (profile.roles ?? []).some((x) => r.roles.includes(x));
      if (!has) reasons.push(`requires one of roles: ${r.roles.join(', ')}`);
    }
    if (typeof r.landholding_max_acres === 'number' && typeof profile.landholdingAcres === 'number' && profile.landholdingAcres > r.landholding_max_acres)
      reasons.push(`landholding ${profile.landholdingAcres} exceeds max ${r.landholding_max_acres} acres`);
    if (typeof r.gender === 'string' && profile.gender && profile.gender !== r.gender) reasons.push(`restricted to gender: ${r.gender}`);
    if (typeof r.age_min === 'number' && typeof profile.age === 'number' && profile.age < r.age_min) reasons.push(`minimum age ${r.age_min}`);
    if (typeof r.age_max === 'number' && typeof profile.age === 'number' && profile.age > r.age_max) reasons.push(`maximum age ${r.age_max}`);
    return { eligible: reasons.length === 0, reasons };
  }
  toJSON() { const v = this.props; return { id: v.id, code: v.code, name: v.defaultName, authorityId: v.authorityId, categoryId: v.categoryId,
    benefitSummary: v.benefitSummary, eligibilityRules: v.eligibilityRules, requiredDocTypeIds: v.requiredDocTypeIds, applicationWindow: v.applicationWindow,
    applicableRegionIds: v.applicableRegionIds, processingFeeMinor: v.processingFeeMinor.toString(), version: v.version, isActive: v.isActive }; }
}
