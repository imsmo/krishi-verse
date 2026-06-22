// modules/tenancy/services/saas-invoice.service.ts · the SaaS-billing-generation plane: raise + issue renewal
// invoices, record payment from the payments event, mark overdue, and let a tenant READ its own invoices. Money is
// bigint minor units and NEVER moves here — collection/void/adjustment are god-mode (admin-api billing-ops); this
// module only reflects payment outcomes onto the invoice. tx-aware methods (raiseAndIssue / applyPayment) run inside
// the worker/relay tx so the state change + outbox event commit atomically (Law 4). Reads are tenant-scoped (RLS).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { SaasInvoice, SaasInvoiceLine } from '../domain/saas-invoice.entity';
import { DomainEvent } from '../domain/tenancy.events';
import { SaasInvoiceNotFoundError, TenantForbiddenError } from '../domain/tenancy.errors';
import { SaasInvoiceRepository } from '../repositories/saas-invoice.repository';
import { QuerySaasInvoiceDto } from '../dto/query-saas-invoice.dto';
import { TenantActor } from '../policies/tenancy.policies';

export interface RaiseInvoiceInput {
  tenantId: string; subscriptionId: string | null; currencyCode: string; taxMinor: bigint; dueDate: string;
  lineItems: SaasInvoiceLine[]; periodTag: string;   // e.g. '202607' — used for per-period idempotency
}

@Injectable()
export class SaasInvoiceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: SaasInvoiceRepository,
  ) {}

  /**
   * Raise + issue a renewal invoice INSIDE the caller's tx (the renewal worker). Idempotent per
   * (subscription, period): if one already exists, returns null. Allocates a gap-free invoice_no.
   */
  async raiseAndIssue(tx: TxContext, input: RaiseInvoiceInput): Promise<SaasInvoice | null> {
    if (input.subscriptionId && await this.repo.existsForPeriod(tx, input.tenantId, input.subscriptionId, input.periodTag)) return null;
    const invoiceNo = await this.repo.nextInvoiceNo(tx, input.tenantId, input.periodTag);
    const inv = SaasInvoice.create({ id: uuidv7(), tenantId: input.tenantId, subscriptionId: input.subscriptionId, invoiceNo, currencyCode: input.currencyCode, lineItems: input.lineItems, taxMinor: input.taxMinor, dueDate: input.dueDate });
    inv.issue();
    await this.repo.insert(tx, inv);
    await this.audit.write(tx, { tenantId: input.tenantId, actorUserId: 'system', action: 'tenancy.saas_invoice_issued', entityType: 'saas_invoice', entityId: inv.id, newValue: { invoiceNo, totalMinor: inv.totalMinor.toString() }, ip: null });
    await this.flush(tx, input.tenantId, inv.id, inv.pullEvents());
    this.metrics.inc('tenancy.saas_invoice_issued', { tenant: input.tenantId });
    return inv;
  }

  /** uow-wrapping renewal entry point for the worker (mirrors GracePeriodJob → SubscriptionService.expire). */
  async raiseRenewal(input: RaiseInvoiceInput): Promise<{ raised: boolean; invoiceId?: string }> {
    return timed(this.metrics, 'tenancy.saas_invoice_renewal', { tenant: input.tenantId }, () =>
      this.uow.run(input.tenantId, async (tx) => {
        const inv = await this.raiseAndIssue(tx, input);
        return inv ? { raised: true, invoiceId: inv.id } : { raised: false };
      }, { userId: 'system' }));
  }

  /**
   * Apply a payment to an invoice INSIDE the caller's tx (the payment-succeeded relay handler). Idempotent: a
   * re-delivered event for an already-paid invoice is a no-op. Returns true if the invoice changed.
   */
  async applyPayment(tx: TxContext, tenantId: string, invoiceId: string, amountMinor: bigint, at: Date): Promise<boolean> {
    const inv = await this.repo.getForUpdate(tx, tenantId, invoiceId);
    if (!inv) return false;                                   // not our invoice / unknown reference → ignore
    const changed = inv.recordPayment(amountMinor, at);
    if (!changed) return false;
    await this.repo.update(tx, inv);
    await this.flush(tx, tenantId, inv.id, inv.pullEvents());
    this.metrics.inc('tenancy.saas_invoice_paid', { tenant: tenantId });
    return true;
  }

  /** Worker overdue sweep: issued/partially_paid past due_date → overdue (enters the dunning queue). */
  async markOverdue(tenantId: string, id: string): Promise<boolean> {
    return timed(this.metrics, 'tenancy.saas_invoice_overdue', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const inv = await this.repo.getForUpdate(tx, tenantId, id);
        if (!inv) return false;
        if (!inv.markOverdue()) return false;
        await this.repo.update(tx, inv);
        await this.flush(tx, tenantId, inv.id, inv.pullEvents());
        return true;
      }, { userId: 'system' }));
  }

  // ---- tenant reads (billing visibility = tenant.settings) ----
  async getById(tenantId: string, actor: TenantActor, id: string) {
    if (!actor.canManage) throw new TenantForbiddenError('viewing billing requires tenant.settings');
    const inv = await this.repo.getById(tenantId, id);
    if (!inv) throw new SaasInvoiceNotFoundError(id);
    return this.serialize(inv);
  }
  async list(tenantId: string, actor: TenantActor, q: Omit<QuerySaasInvoiceDto, 'cursor'> & { cursor?: { c: string; id: string } }) {
    if (!actor.canManage) throw new TenantForbiddenError('viewing billing requires tenant.settings');
    const rows = await this.repo.list(tenantId, { status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((i) => this.serialize(i));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last && last.createdAt ? Buffer.from(`${last.createdAt instanceof Date ? last.createdAt.toISOString() : last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(inv: SaasInvoice) {
    const p = inv.toProps();
    return { id: p.id, invoiceNo: p.invoiceNo, subscriptionId: p.subscriptionId, status: p.status, currencyCode: p.currencyCode,
      subtotalMinor: p.subtotalMinor.toString(), taxMinor: p.taxMinor.toString(), totalMinor: p.totalMinor.toString(),
      dueDate: p.dueDate, paidAt: p.paidAt ?? null, dunningAttempts: p.dunningAttempts, createdAt: p.createdAt ?? null };
  }
  private async flush(tx: TxContext, tenantId: string, aggregateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'saas_invoice', aggregateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
