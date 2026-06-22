// modules/tenancy/__tests__/saas-invoice.spec.ts · pure-domain unit tests for API-W3-06: the invoice_status state
// machine (mirrors admin-api billing-ops) + the SaasInvoice aggregate (totals math in bigint minor units,
// issue/recordPayment/markOverdue transitions, idempotent re-payment). Service UoW/outbox/RLS + the
// payment-succeeded handler are covered by saas-invoice.integration.spec.ts.
import { canTransition, isOwing, isTerminal, INVOICE_STATUSES, InvoiceStatus, IllegalInvoiceTransitionError } from '../domain/saas-invoice.state';
import { SaasInvoice } from '../domain/saas-invoice.entity';
import { InvalidSaasInvoiceError } from '../domain/tenancy.errors';
import { TenancyEventType } from '../domain/tenancy.events';

const mk = (over: any = {}) => SaasInvoice.create({
  id: 'inv1', tenantId: 't1', subscriptionId: 's1', invoiceNo: 'SINV-202607-000001', currencyCode: 'INR',
  taxMinor: 0n, dueDate: '2026-07-31',
  lineItems: [{ desc: 'Subscription renewal', qty: 1, unitMinor: 99900n, totalMinor: 99900n }], ...over,
});

describe('invoice_status state machine', () => {
  it('allows documented transitions, forbids illegal ones', () => {
    expect(canTransition('draft', 'issued')).toBe(true);
    expect(canTransition('issued', 'paid')).toBe(true);
    expect(canTransition('issued', 'overdue')).toBe(true);
    expect(canTransition('overdue', 'paid')).toBe(true);
    expect(canTransition('paid', 'issued')).toBe(false);   // terminal
    expect(canTransition('void', 'paid')).toBe(false);      // terminal
    expect(isOwing('issued')).toBe(true); expect(isOwing('partially_paid')).toBe(true); expect(isOwing('paid')).toBe(false);
    expect(isTerminal('paid')).toBe(true); expect(isTerminal('void')).toBe(true);
  });
  it('covers every status', () => { for (const s of INVOICE_STATUSES) expect(() => canTransition(s, 'void' as InvoiceStatus)).not.toThrow(); });
});

describe('SaasInvoice aggregate', () => {
  it('derives totals and validates line math', () => {
    const inv = mk({ taxMinor: 17982n });   // 18% GST on 99900
    const p = inv.toProps();
    expect(p.subtotalMinor).toBe(99900n); expect(p.taxMinor).toBe(17982n); expect(p.totalMinor).toBe(117882n);
    expect(p.status).toBe('draft');
  });
  it('rejects a line whose total ≠ unit × qty, empty lines, and bad dates', () => {
    expect(() => mk({ lineItems: [{ desc: 'x', qty: 2, unitMinor: 100n, totalMinor: 150n }] })).toThrow(InvalidSaasInvoiceError);
    expect(() => mk({ lineItems: [] })).toThrow(InvalidSaasInvoiceError);
    expect(() => mk({ dueDate: '31-07-2026' })).toThrow(InvalidSaasInvoiceError);
  });
  it('issue emits issued; cannot issue twice', () => {
    const inv = mk(); inv.issue();
    expect(inv.status).toBe('issued');
    expect(inv.pullEvents().map((e) => e.type)).toContain(TenancyEventType.SaasInvoiceIssued);
    expect(() => inv.issue()).toThrow(IllegalInvoiceTransitionError);
  });
  it('recordPayment: full → paid; partial → partially_paid; re-pay is idempotent no-op', () => {
    const full = mk(); full.issue(); full.pullEvents();
    expect(full.recordPayment(99900n, new Date())).toBe(true);
    expect(full.status).toBe('paid'); expect(full.toProps().paidAt).not.toBeNull();
    expect(full.recordPayment(99900n, new Date())).toBe(false);   // idempotent

    const part = mk(); part.issue(); part.pullEvents();
    expect(part.recordPayment(50000n, new Date())).toBe(true);
    expect(part.status).toBe('partially_paid');
    expect(part.recordPayment(60000n, new Date())).toBe(false);    // another partial under total → no transition
    expect(part.recordPayment(99900n, new Date())).toBe(true);     // full settlement → paid
    expect(part.status).toBe('paid');
  });
  it('markOverdue only from issued/partially_paid; idempotent', () => {
    const inv = mk(); inv.issue(); inv.pullEvents();
    expect(inv.markOverdue()).toBe(true); expect(inv.status).toBe('overdue');
    expect(inv.markOverdue()).toBe(false);
    const draft = mk();
    expect(draft.markOverdue()).toBe(false);   // a draft is never overdue
  });
});
