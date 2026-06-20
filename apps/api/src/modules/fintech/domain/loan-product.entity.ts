// modules/fintech/domain/loan-product.entity.ts · read-only VO for loan_products (a partner's catalog).
// GLOBAL reference data (no tenant_id). Money fields are bigint minor units (Law 2). The applied amount must
// fall within [min,max]; the interest APR is in basis points (integer, never float).
export interface LoanProductProps {
  id: string; partnerId: string; productKindId: string; defaultName: string; currencyCode: string;
  minAmountMinor: bigint; maxAmountMinor: bigint; interestAprBps: number; tenureMonthsMin: number | null; tenureMonthsMax: number | null;
  collateralKind: string | null; repaymentStyle: string; isActive: boolean; createdAt?: Date;
}
export class LoanProduct {
  private constructor(private readonly props: LoanProductProps) {}
  static rehydrate(p: LoanProductProps): LoanProduct { return new LoanProduct(p); }
  get id() { return this.props.id; }
  get partnerId() { return this.props.partnerId; }
  get minAmountMinor() { return this.props.minAmountMinor; }
  get maxAmountMinor() { return this.props.maxAmountMinor; }
  get interestAprBps() { return this.props.interestAprBps; }
  get isActive() { return this.props.isActive; }
  toJSON() { const v = this.props; return { id: v.id, partnerId: v.partnerId, productKindId: v.productKindId, name: v.defaultName, currencyCode: v.currencyCode,
    minAmountMinor: v.minAmountMinor.toString(), maxAmountMinor: v.maxAmountMinor.toString(), interestAprBps: v.interestAprBps,
    tenureMonthsMin: v.tenureMonthsMin, tenureMonthsMax: v.tenureMonthsMax, collateralKind: v.collateralKind, repaymentStyle: v.repaymentStyle, isActive: v.isActive }; }
}
