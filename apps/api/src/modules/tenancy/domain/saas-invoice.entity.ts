// modules/tenancy/domain/saas-invoice.entity.ts · a SaaS invoice we raise TO a tenant for its subscription
// (0002 saas_invoices + 0035 dunning columns). Pure TS. Money is ALWAYS bigint minor units; totals are derived
// (subtotal + tax) and validated, never floats. Status moves ONLY through the state machine (Law 5). No version
// column → the service locks the row FOR UPDATE. Collection/void/adjustment are god-mode (admin-api billing-ops).
import { InvoiceStatus, assertTransition, isOwing } from './saas-invoice.state';
import { InvalidSaasInvoiceError, SaasInvoiceNotPayableError } from './tenancy.errors';
import { TenancyEventType, DomainEvent } from './tenancy.events';

export interface SaasInvoiceLine { desc: string; qty: number; unitMinor: bigint; totalMinor: bigint; }
export interface SaasInvoiceProps {
  id: string; tenantId: string; subscriptionId: string | null; invoiceNo: string; status: InvoiceStatus;
  currencyCode: string; subtotalMinor: bigint; taxMinor: bigint; totalMinor: bigint; dueDate: string;
  paidAt: Date | null; lineItems: SaasInvoiceLine[]; dunningAttempts: number; createdAt?: Date | null;
}

const CUR_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function assertCur(c: string): string { const s = c.toUpperCase(); if (!CUR_RE.test(s)) throw new InvalidSaasInvoiceError('currency must be ISO-4217 (3 letters)'); return s; }
function nonNeg(v: bigint, label: string): bigint { if (typeof v !== 'bigint' || v < 0n) throw new InvalidSaasInvoiceError(`${label} must be a non-negative bigint (minor units)`); return v; }

export class SaasInvoice {
  private readonly events: DomainEvent[] = [];
  private constructor(private p: SaasInvoiceProps) {}

  /** Raise a fresh invoice (status 'draft'). totals are validated: subtotal + tax === total; line totals sum to subtotal. */
  static create(input: {
    id: string; tenantId: string; subscriptionId: string | null; invoiceNo: string; currencyCode: string;
    lineItems: SaasInvoiceLine[]; taxMinor: bigint; dueDate: string;
  }): SaasInvoice {
    if (!input.invoiceNo) throw new InvalidSaasInvoiceError('invoice_no is required');
    if (!DATE_RE.test(input.dueDate)) throw new InvalidSaasInvoiceError('due_date must be YYYY-MM-DD');
    if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) throw new InvalidSaasInvoiceError('at least one line item is required');
    if (input.lineItems.length > 200) throw new InvalidSaasInvoiceError('too many line items (≤200)');
    let subtotal = 0n;
    for (const li of input.lineItems) {
      if (!li.desc || li.desc.length > 300) throw new InvalidSaasInvoiceError('line desc required (≤300)');
      if (!Number.isInteger(li.qty) || li.qty <= 0) throw new InvalidSaasInvoiceError('line qty must be a positive integer');
      nonNeg(li.unitMinor, 'unit_minor'); nonNeg(li.totalMinor, 'line total_minor');
      if (li.unitMinor * BigInt(li.qty) !== li.totalMinor) throw new InvalidSaasInvoiceError('line total_minor must equal unit_minor × qty');
      subtotal += li.totalMinor;
    }
    const tax = nonNeg(input.taxMinor, 'tax_minor');
    const inv = new SaasInvoice({
      id: input.id, tenantId: input.tenantId, subscriptionId: input.subscriptionId, invoiceNo: input.invoiceNo,
      status: 'draft', currencyCode: assertCur(input.currencyCode), subtotalMinor: subtotal, taxMinor: tax,
      totalMinor: subtotal + tax, dueDate: input.dueDate, paidAt: null, lineItems: input.lineItems, dunningAttempts: 0,
    });
    return inv;
  }
  static rehydrate(p: SaasInvoiceProps): SaasInvoice { return new SaasInvoice(p); }

  get id() { return this.p.id; }
  get status() { return this.p.status; }
  get tenantId() { return this.p.tenantId; }
  get totalMinor() { return this.p.totalMinor; }
  toProps(): Readonly<SaasInvoiceProps> { return Object.freeze({ ...this.p, lineItems: [...this.p.lineItems] }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** draft → issued: the invoice is now payable + dunnable. Emits saas_invoice_issued (→ notify the tenant). */
  issue(): void {
    assertTransition(this.p.status, 'issued');
    this.p.status = 'issued';
    this.events.push({ type: TenancyEventType.SaasInvoiceIssued, payload: { invoiceId: this.p.id, tenantId: this.p.tenantId, invoiceNo: this.p.invoiceNo, totalMinor: this.p.totalMinor.toString(), dueDate: this.p.dueDate } });
  }

  /**
   * Record a payment against this invoice (from payments.payment_succeeded). Fully covers → paid; partial →
   * partially_paid. Idempotent: re-applying once paid is a no-op (returns false). Amount in bigint minor units.
   */
  recordPayment(amountMinor: bigint, at: Date): boolean {
    if (this.p.status === 'paid' || this.p.status === 'void') return false;     // idempotent / terminal
    if (!isOwing(this.p.status)) throw new SaasInvoiceNotPayableError(this.p.status);
    nonNeg(amountMinor, 'amount_minor');
    const to: InvoiceStatus = amountMinor >= this.p.totalMinor ? 'paid' : 'partially_paid';
    if (to === this.p.status) return false;     // a further partial that doesn't settle the invoice → no transition
    assertTransition(this.p.status, to);
    this.p.status = to;
    if (to === 'paid') this.p.paidAt = at;
    this.events.push({ type: TenancyEventType.SaasInvoicePaid, payload: { invoiceId: this.p.id, tenantId: this.p.tenantId, status: to, amountMinor: amountMinor.toString() } });
    return true;
  }

  /** issued/partially_paid → overdue (past due_date). System/worker transition; enters the dunning queue. */
  markOverdue(): boolean {
    if (this.p.status === 'overdue') return false;
    if (this.p.status !== 'issued' && this.p.status !== 'partially_paid') return false;
    assertTransition(this.p.status, 'overdue');
    this.p.status = 'overdue';
    this.events.push({ type: TenancyEventType.SaasInvoiceOverdue, payload: { invoiceId: this.p.id, tenantId: this.p.tenantId, invoiceNo: this.p.invoiceNo } });
    return true;
  }
}
