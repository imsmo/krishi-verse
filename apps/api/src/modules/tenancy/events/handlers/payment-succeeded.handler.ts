// modules/tenancy/events/handlers/payment-succeeded.handler.ts
// Consumes payments.payment_succeeded (delivered by the outbox relay). Acts ONLY on payments whose
// referenceType is 'saas_invoice' — i.e. a tenant paying its SaaS bill — and marks that invoice paid /
// partially_paid via the invoice state machine. Runs INSIDE the relay tx and touches only this module's repo.
// IDEMPOTENT at the consumer: a re-delivered event for an already-paid invoice is a no-op (applyPayment returns
// false). Other payment references (orders, wallet recharge, EMD, …) are ignored here.
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { SaasInvoiceService } from '../../services/saas-invoice.service';

@Injectable()
export class SaasInvoicePaymentHandler implements OutboxHandler {
  readonly eventType = 'payments.payment_succeeded';
  constructor(private readonly invoices: SaasInvoiceService) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    if (!tenantId || p.referenceType !== 'saas_invoice') return;       // not a SaaS-invoice payment → ignore
    const invoiceId = typeof p.referenceId === 'string' ? p.referenceId : undefined;
    const amountRaw = p.amountMinor;
    if (!invoiceId || amountRaw === undefined || amountRaw === null) return;
    let amountMinor: bigint;
    try { amountMinor = BigInt(amountRaw as any); } catch { return; }   // malformed amount → ignore (fail closed)
    if (amountMinor <= 0n) return;
    await this.invoices.applyPayment(tx, tenantId, invoiceId, amountMinor, new Date());   // idempotent
  }
}
