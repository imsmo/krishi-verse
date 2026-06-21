// apps/admin-api/src/modules/billing-ops/domain/invoice.entity.ts · the SaaS-invoice aggregate (pure, no I/O).
// Holds the money as bigint MINOR UNITS (Law 2) and is the only place status changes are applied — always via
// the state machine. The console drives issue()/void()/markOverdue(); paid/partially_paid come from payments.
import { InvoiceStatus, assertTransition } from './invoice.state';

export interface InvoiceProps {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  invoiceNo: string;
  status: InvoiceStatus;
  currencyCode: string;
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  dueDate: string | Date;
  paidAt: Date | null;
  dunningAttempts: number;
  lastDunnedAt: Date | null;
  createdAt?: Date | null;
}

export interface StatusChange { from: InvoiceStatus; to: InvoiceStatus; }

export class SaasInvoice {
  private constructor(private p: InvoiceProps) {}
  static rehydrate(p: InvoiceProps): SaasInvoice { return new SaasInvoice(p); }

  get status(): InvoiceStatus { return this.p.status; }
  get tenantId(): string { return this.p.tenantId; }
  get dunningAttempts(): number { return this.p.dunningAttempts; }

  private to(next: InvoiceStatus): StatusChange {
    const from = this.p.status;
    assertTransition(from, next);          // throws IllegalInvoiceTransitionError
    this.p.status = next;
    return { from, to: next };
  }

  /** draft → issued (the invoice is now payable + dunnable). */
  issue(): StatusChange { return this.to('issued'); }
  /** issued/partially_paid → overdue (past due_date, enters the dunning queue). */
  markOverdue(): StatusChange { return this.to('overdue'); }
  /** → void: write-off / cancellation (terminal). Reason is recorded by the service in the audit row. */
  void(): StatusChange { return this.to('void'); }

  toJSON() {
    return {
      id: this.p.id, tenantId: this.p.tenantId, subscriptionId: this.p.subscriptionId, invoiceNo: this.p.invoiceNo,
      status: this.p.status, currency: this.p.currencyCode,
      subtotalMinor: this.p.subtotalMinor.toString(), taxMinor: this.p.taxMinor.toString(), totalMinor: this.p.totalMinor.toString(),
      dueDate: this.p.dueDate, paidAt: this.p.paidAt, dunningAttempts: this.p.dunningAttempts, lastDunnedAt: this.p.lastDunnedAt,
      createdAt: this.p.createdAt ?? null,
    };
  }
}
