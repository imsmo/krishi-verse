// modules/tenancy/domain/saas-invoice.state.ts · the invoice_status state machine as the BILLING-GENERATION plane
// sees it (Law 5). Mirrors the invoice_status ENUM in db/migrations/0002 and the AUTHORITATIVE machine in
// apps/admin-api billing-ops (kept identical so the two planes interoperate):
//   draft → issued → paid | partially_paid | overdue | void ; paid/void terminal.
// In apps/api this module DRIVES draft→issued (renewal billing run), issued/overdue→paid|partially_paid (from the
// payments event), and issued/partially_paid→overdue (past due). VOID (write-off) is god-mode (admin-api) and is
// intentionally NOT invoked here.
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
  readonly code = 'SAAS_INVOICE_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move SaaS invoice ${from}→${to}`);
    this.name = 'IllegalInvoiceTransitionError';
  }
}
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void { if (!canTransition(from, to)) throw new IllegalInvoiceTransitionError(from, to); }
/** Owes money → payable + dunnable. */
export function isOwing(s: InvoiceStatus): boolean { return s === 'issued' || s === 'partially_paid' || s === 'overdue'; }
export function isTerminal(s: InvoiceStatus): boolean { return s === 'paid' || s === 'void'; }
