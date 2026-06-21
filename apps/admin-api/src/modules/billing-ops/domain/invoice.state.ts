// apps/admin-api/src/modules/billing-ops/domain/invoice.state.ts · the SaaS-invoice status state machine (Law 5 —
// the ONLY place transitions are decided). Mirrors the invoice_status ENUM in db/migrations/0002_tenancy_billing:
//   draft → issued → paid | partially_paid | overdue | void
// 'paid'/'partially_paid' normally arrive from a real payment reconciliation; 'void' (write-off) and
// 'issued'/'overdue' are the consequential admin transitions billing-ops drives. paid/void are terminal.
export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = Object.freeze({
  draft:          ['issued', 'void'],
  issued:         ['paid', 'partially_paid', 'overdue', 'void'],
  partially_paid: ['paid', 'overdue', 'void'],
  overdue:        ['paid', 'partially_paid', 'void'],
  paid:           [],
  void:           [],
});

export class IllegalInvoiceTransitionError extends Error {
  readonly code = 'BILLING_INVOICE_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move invoice ${from}→${to}`);
    this.name = 'IllegalInvoiceTransitionError';
  }
}
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) throw new IllegalInvoiceTransitionError(from, to);
}
export function isTerminal(s: InvoiceStatus): boolean { return s === 'paid' || s === 'void'; }
