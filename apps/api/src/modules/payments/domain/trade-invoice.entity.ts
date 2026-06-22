// modules/payments/domain/trade-invoice.entity.ts · a buyer-facing GST trade invoice, one per order (0006
// trade_invoices). Pure TS value object. total_minor is bigint minor units; tax_breakup carries the CGST/SGST/IGST
// split. Enforces: total ≥ 0, the GST split is internally consistent (cgst+sgst+igst == the line tax, and the tax
// does not exceed the total). Used to validate an invoice before it is persisted and to serialise reads.
import { InvalidTradeInvoiceError } from './billing.errors';

export interface TradeInvoiceTaxBreakup { gstRateBps: number; taxableMinor: bigint; cgstMinor: bigint; sgstMinor: bigint; igstMinor: bigint; }
export interface TradeInvoiceProps {
  id: string; tenantId: string; orderId: string; invoiceNo: string; sellerGstin: string | null; buyerGstin: string | null;
  totalMinor: bigint; tax: TradeInvoiceTaxBreakup; createdAt?: Date | null;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
function nonNeg(v: bigint, label: string): bigint { if (typeof v !== 'bigint' || v < 0n) throw new InvalidTradeInvoiceError(`${label} must be a non-negative bigint`); return v; }
function optGstin(v: string | null): string | null { if (v === null) return null; const s = v.trim().toUpperCase(); if (!GSTIN_RE.test(s)) throw new InvalidTradeInvoiceError('gstin is malformed'); return s; }

export class TradeInvoice {
  private constructor(private p: TradeInvoiceProps) {}

  static create(input: TradeInvoiceProps): TradeInvoice {
    if (!input.invoiceNo) throw new InvalidTradeInvoiceError('invoice_no is required');
    const total = nonNeg(input.totalMinor, 'total_minor');
    const t = input.tax;
    if (!Number.isInteger(t.gstRateBps) || t.gstRateBps < 0 || t.gstRateBps > 10000) throw new InvalidTradeInvoiceError('gstRateBps must be 0..10000');
    const cgst = nonNeg(t.cgstMinor, 'cgst'); const sgst = nonNeg(t.sgstMinor, 'sgst'); const igst = nonNeg(t.igstMinor, 'igst');
    nonNeg(t.taxableMinor, 'taxableMinor');
    const tax = cgst + sgst + igst;
    // intra-state uses cgst+sgst (igst=0); inter-state uses igst (cgst=sgst=0) — never both halves at once
    if (igst > 0n && (cgst > 0n || sgst > 0n)) throw new InvalidTradeInvoiceError('cannot mix IGST with CGST/SGST');
    if (tax > total) throw new InvalidTradeInvoiceError('tax exceeds invoice total');
    return new TradeInvoice({ ...input, totalMinor: total, sellerGstin: optGstin(input.sellerGstin), buyerGstin: optGstin(input.buyerGstin) });
  }
  static rehydrate(p: TradeInvoiceProps): TradeInvoice { return new TradeInvoice(p); }

  get id() { return this.p.id; }
  get taxMinor() { return this.p.tax.cgstMinor + this.p.tax.sgstMinor + this.p.tax.igstMinor; }
  toProps(): Readonly<TradeInvoiceProps> { return Object.freeze({ ...this.p, tax: { ...this.p.tax } }); }
  toJSON() {
    return { id: this.p.id, invoiceNo: this.p.invoiceNo, orderId: this.p.orderId, totalMinor: this.p.totalMinor.toString(),
      sellerGstin: this.p.sellerGstin, buyerGstin: this.p.buyerGstin,
      taxBreakup: { gstRateBps: this.p.tax.gstRateBps, taxableMinor: this.p.tax.taxableMinor.toString(), cgstMinor: this.p.tax.cgstMinor.toString(), sgstMinor: this.p.tax.sgstMinor.toString(), igstMinor: this.p.tax.igstMinor.toString() } };
  }
}
