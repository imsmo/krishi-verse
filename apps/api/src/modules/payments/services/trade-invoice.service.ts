// modules/payments/services/trade-invoice.service.ts
// Buyer-facing GST trade invoice, one per order. Generated at order completion (idempotent on
// order). Resolves the applicable GST rate (tax_rules) and records an intra-state CGST/SGST split
// in tax_breakup; total = the order total. invoice_no is GST-compliant sequential (next_doc_number).
// PII: never stores raw GSTINs beyond what KYC vaulted (GSTIN wiring deferred → null for now).
// Reads are ownership-gated (buyer/seller/finance) — 404 to others (no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { applyBps } from '../domain/commission-rule.entity';
import { TradeInvoice } from '../domain/trade-invoice.entity';
import { TaxRuleRepository } from '../repositories/tax-rule.repository';
import { TradeInvoiceRepository, TradeInvoiceRow } from '../repositories/trade-invoice.repository';
import { InvoiceNotFoundError } from '../domain/billing.errors';

export interface InvoiceActor { userId: string; canModerate: boolean; }

@Injectable()
export class TradeInvoiceService {
  constructor(
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly tax: TaxRuleRepository,
    private readonly invoices: TradeInvoiceRepository,
  ) {}

  /** Generate the order's invoice within the caller's tx (called by the order-completed handler). */
  async generateForOrder(tx: TxContext, input: { tenantId: string; orderId: string; buyerUserId: string | null; sellerUserId: string | null; totalMinor: bigint; categoryId?: string | null; countryCode?: string }): Promise<void> {
    const existing = await this.invoices.findByOrder(tx, input.tenantId, input.orderId);
    if (existing) return;                                  // idempotent — one invoice per order

    const gst = await this.tax.resolve(tx, { countryCode: input.countryCode ?? 'IN', taxCode: 'gst', categoryId: input.categoryId ?? null });
    const gstRateBps = gst?.rateBps ?? 0;
    const taxMinor = applyBps(input.totalMinor, gstRateBps);
    const cgst = taxMinor / 2n;
    const sgst = taxMinor - cgst;                          // remainder so cgst+sgst == taxMinor exactly
    const taxBreakup = { gstRateBps, taxableMinor: input.totalMinor.toString(), cgstMinor: cgst.toString(), sgstMinor: sgst.toString(), igstMinor: '0' };

    const invoiceNo = await this.invoices.nextNumber(tx, input.tenantId, String(new Date().getUTCFullYear()));
    const id = uuidv7();
    // domain guard: validate totals + GST split are internally consistent before persisting (fail closed)
    TradeInvoice.create({ id, tenantId: input.tenantId, orderId: input.orderId, invoiceNo, sellerGstin: null, buyerGstin: null,
      totalMinor: input.totalMinor, tax: { gstRateBps, taxableMinor: input.totalMinor, cgstMinor: cgst, sgstMinor: sgst, igstMinor: 0n } });
    await this.invoices.insertIfAbsent(tx, {
      id, tenantId: input.tenantId, orderId: input.orderId, invoiceNo,
      buyerUserId: input.buyerUserId, sellerUserId: input.sellerUserId, sellerGstin: null, buyerGstin: null,
      totalMinor: input.totalMinor, taxBreakup,
    });
    this.metrics.inc('payments.invoice_generated', { tenant: input.tenantId });
  }

  async getByOrder(tenantId: string, actor: InvoiceActor, orderId: string): Promise<TradeInvoiceRow> {
    const inv = await this.invoices.getByOrderVisible(tenantId, orderId, actor.userId, actor.canModerate);
    if (!inv) throw new InvoiceNotFoundError();
    return inv;
  }
}
