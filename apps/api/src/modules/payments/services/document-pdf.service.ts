// modules/payments/services/document-pdf.service.ts
// Renders the financial DOCUMENTS (seller settlement statement, buyer GST invoice) into real PDFs
// and stores them via the media boundary (putGeneratedDocument → clean tenant document), recording
// pdf_media_id. Rendering is pure (renderTextPdf); storage is gated by the `document_pdfs` flag
// (default OFF) since it performs a real S3 PUT — so default flows never touch S3. Idempotent-ish:
// re-storing simply attaches a fresh media id.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { FlagsService } from '../../../core/feature-flags/flags.service';
import { MediaService } from '../../../core/media/media-links.service';
import { renderTextPdf, formatMinor } from '../../../core/media/pdf/pdf-writer';
import { SettlementStatementRepository, SettlementStatementRow } from '../repositories/settlement-statement.repository';
import { TradeInvoiceRepository } from '../repositories/trade-invoice.repository';

@Injectable()
export class DocumentPdfService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly flags: FlagsService,
    private readonly media: MediaService,
    private readonly statements: SettlementStatementRepository,
    private readonly invoices: TradeInvoiceRepository,
  ) {}

  /** Pure: a settlement statement → PDF bytes. */
  renderStatement(s: SettlementStatementRow): Buffer {
    return renderTextPdf(`Settlement Statement ${s.statementNo}`, [
      `Seller: ${s.sellerUserId}`,
      `Period: ${s.periodStart} to ${s.periodEnd}`,
      '',
      `Gross         : INR ${formatMinor(s.grossMinor)}`,
      `Commission    : INR ${formatMinor(s.commissionMinor)}`,
      `Tax (GST+TDS) : INR ${formatMinor(s.taxMinor)}`,
      `Net payable   : INR ${formatMinor(s.netMinor)}`,
      '',
      'This is a computer-generated statement.',
    ]);
  }

  /** Pure: a trade invoice → PDF bytes. */
  renderInvoice(inv: { invoiceNo: string; orderId: string; totalMinor: string; taxBreakup: Record<string, unknown> }): Buffer {
    const b = inv.taxBreakup as { cgstMinor?: string; sgstMinor?: string; gstRateBps?: number };
    return renderTextPdf(`Tax Invoice ${inv.invoiceNo}`, [
      `Order: ${inv.orderId}`,
      '',
      `Taxable value : INR ${formatMinor(inv.totalMinor)}`,
      `CGST          : INR ${formatMinor(b.cgstMinor ?? '0')}`,
      `SGST          : INR ${formatMinor(b.sgstMinor ?? '0')}`,
      `GST rate      : ${((b.gstRateBps ?? 0) / 100).toFixed(2)}%`,
      '',
      'This is a computer-generated invoice.',
    ]);
  }

  /** Render + store a statement PDF, attaching pdf_media_id. No-op unless the flag is on. */
  async storeStatementPdf(tenantId: string, statement: SettlementStatementRow): Promise<string | null> {
    if (!(await this.flags.isEnabled('document_pdfs', { tenantId }))) return null;
    const mediaId = await this.media.putGeneratedDocument(tenantId, this.renderStatement(statement));
    await this.uow.run(tenantId, async (tx) => this.statements.setPdfMediaId(tx, tenantId, statement.id, mediaId), { userId: 'system' });
    this.metrics.inc('payments.statement_pdf', { tenant: tenantId });
    return mediaId;
  }

  /** Render + store an invoice PDF for an order, attaching pdf_media_id. No-op unless the flag is on. */
  async storeInvoicePdf(tenantId: string, orderId: string): Promise<string | null> {
    if (!(await this.flags.isEnabled('document_pdfs', { tenantId }))) return null;
    const inv = await this.uow.run(tenantId, async (tx) => this.invoices.findByOrder(tx, tenantId, orderId), { userId: 'system' });
    if (!inv) return null;
    const mediaId = await this.media.putGeneratedDocument(tenantId, this.renderInvoice(inv));
    await this.uow.run(tenantId, async (tx) => this.invoices.setPdfMediaId(tx, tenantId, orderId, mediaId), { userId: 'system' });
    this.metrics.inc('payments.invoice_pdf', { tenant: tenantId });
    return mediaId;
  }
}
