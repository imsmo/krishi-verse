// modules/exports/domain/compliance-requirement.entity.ts · read-only VO for compliance_requirements.
// GLOBAL reference data (no tenant_id): country-specific MRL/cert rules (EU MRL, USDA NOP, JAS organic…).
// Authored on the admin/platform surface (Law 11) — this tenant-facing module only READS it.
export interface ComplianceRequirementProps {
  id: string; destinationCountry: string; categoryId: string | null; requirementCode: string; rules: Record<string, unknown>; effectiveFrom: string; effectiveTo: string | null;
}
export class ComplianceRequirement {
  private constructor(private readonly props: ComplianceRequirementProps) {}
  static rehydrate(p: ComplianceRequirementProps): ComplianceRequirement { return new ComplianceRequirement(p); }
  get id() { return this.props.id; }
  toJSON() { const v = this.props; return { id: v.id, destinationCountry: v.destinationCountry, categoryId: v.categoryId, requirementCode: v.requirementCode, rules: v.rules, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo }; }
}
