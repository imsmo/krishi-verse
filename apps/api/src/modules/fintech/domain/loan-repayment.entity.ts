// modules/fintech/domain/loan-repayment.entity.ts · the loan_repayments aggregate (one row per payment).
// PARTITIONED by created_at (Law 8). Money is bigint minor units. This build records ad-hoc repayments
// (amount_due = amount_paid = the payment); a pre-generated EMI schedule is deferred (documented).
export interface LoanRepaymentProps {
  id: string; loanId: string; tenantId: string; dueDate: string; amountDueMinor: bigint; amountPaidMinor: bigint; paidAt: Date | null; channel: string | null; createdAt?: Date;
}
export class LoanRepayment {
  private constructor(private readonly props: LoanRepaymentProps) {}
  static record(input: Omit<LoanRepaymentProps, 'createdAt'>): LoanRepayment { return new LoanRepayment(input); }
  static rehydrate(props: LoanRepaymentProps): LoanRepayment { return new LoanRepayment(props); }
  get id() { return this.props.id; }
  toProps(): Readonly<LoanRepaymentProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, loanId: v.loanId, dueDate: v.dueDate, amountDueMinor: v.amountDueMinor.toString(), amountPaidMinor: v.amountPaidMinor.toString(), paidAt: v.paidAt, channel: v.channel, createdAt: v.createdAt }; }
}
