// modules/fintech/domain/fintech.events.ts · integration events published by fintech (via outbox, Law 4).
export const FintechEventType = {
  ApplicationSubmitted: 'fintech.loan_application_submitted',
  ApplicationReviewing: 'fintech.loan_application_reviewing',
  ApplicationApproved:  'fintech.loan_application_approved',
  ApplicationRejected:  'fintech.loan_application_rejected',
  ApplicationWithdrawn: 'fintech.loan_application_withdrawn',
  LoanDisbursed:        'fintech.loan_disbursed',
  LoanRepaid:           'fintech.loan_repaid',
  LoanClosed:           'fintech.loan_closed',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const PARTNER_KINDS = ['bank', 'nbfc', 'mfi', 'insurer', 'amc', 'gold_loan'] as const;
export const REPAYMENT_STYLES = ['emi', 'bullet', 'harvest_aligned', 'milk_bill_deduction'] as const;
