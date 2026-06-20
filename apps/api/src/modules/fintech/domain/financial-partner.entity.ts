// modules/fintech/domain/financial-partner.entity.ts · read-only VO for financial_partners.
// GLOBAL lender registry (no tenant_id): banks/NBFCs/MFIs/insurers, with their regulator licence. Authored
// on the admin/platform surface (Law 11); this tenant-facing module only READS it.
export interface FinancialPartnerProps {
  id: string; code: string; defaultName: string; partnerKind: string; regulatorRef: string | null; isActive: boolean; createdAt?: Date;
}
export class FinancialPartner {
  private constructor(private readonly props: FinancialPartnerProps) {}
  static rehydrate(p: FinancialPartnerProps): FinancialPartner { return new FinancialPartner(p); }
  get id() { return this.props.id; }
  toJSON() { const v = this.props; return { id: v.id, code: v.code, name: v.defaultName, partnerKind: v.partnerKind, regulatorRef: v.regulatorRef, isActive: v.isActive }; }
}
