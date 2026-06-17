// modules/payments/repositories/trade-invoice.repository.ts
// Buyer-facing GST trade invoices (one per order). tenant_id in EVERY query (Law 1) + RLS.
// invoice_no is GST-compliant sequential via next_doc_number(); generation is idempotent on
// (tenant_id, order_id) (unique index, migration 0019). Reads off the replica; writes in tx.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export interface TradeInvoiceRow {
  id: string; invoiceNo: string; orderId: string; sellerGstin: string | null; buyerGstin: string | null;
  totalMinor: string; taxBreakup: Record<string, unknown>; createdAt: Date;
}
const COLS = `id, invoice_no, order_id, seller_gstin, buyer_gstin, total_minor, tax_breakup, created_at`;
function toRow(r: any): TradeInvoiceRow {
  return { id: r.id, invoiceNo: r.invoice_no, orderId: r.order_id, sellerGstin: r.seller_gstin, buyerGstin: r.buyer_gstin, totalMinor: String(r.total_minor), taxBreakup: r.tax_breakup, createdAt: r.created_at };
}

@Injectable()
export class TradeInvoiceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async findByOrder(tx: TxContext, tenantId: string, orderId: string): Promise<TradeInvoiceRow | null> {
    const r = await tx.query(`SELECT ${COLS} FROM trade_invoices WHERE tenant_id=$1 AND order_id=$2`, [tenantId, orderId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  async nextNumber(tx: TxContext, tenantId: string, period: string): Promise<string> {
    const r = await tx.query<{ n: string }>(`SELECT next_doc_number($1,'invoice','INV',$2) n`, [tenantId, period]);
    return r.rows[0].n;
  }

  /** Idempotent insert (one invoice per order). Returns true if inserted, false if it already existed. */
  async insertIfAbsent(tx: TxContext, i: { id: string; tenantId: string; orderId: string; invoiceNo: string; buyerUserId: string | null; sellerUserId: string | null; sellerGstin: string | null; buyerGstin: string | null; totalMinor: bigint; taxBreakup: Record<string, unknown> }): Promise<boolean> {
    const r = await tx.query(
      `INSERT INTO trade_invoices (id, tenant_id, order_id, invoice_no, buyer_user_id, seller_user_id, seller_gstin, buyer_gstin, total_minor, tax_breakup)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (tenant_id, order_id) DO NOTHING`,
      [i.id, i.tenantId, i.orderId, i.invoiceNo, i.buyerUserId, i.sellerUserId, i.sellerGstin, i.buyerGstin, i.totalMinor.toString(), JSON.stringify(i.taxBreakup)]);
    return (r.rowCount ?? 0) > 0;
  }

  /** Attach the rendered PDF media id (tenant-scoped). */
  async setPdfMediaId(tx: TxContext, tenantId: string, orderId: string, mediaId: string): Promise<void> {
    await tx.query(`UPDATE trade_invoices SET pdf_media_id=$3, updated_at=now() WHERE tenant_id=$1 AND order_id=$2`, [tenantId, orderId, mediaId]);
  }

  /** Visible to the order's buyer or seller, or a finance moderator (404 otherwise — no IDOR). */
  async getByOrderVisible(tenantId: string, orderId: string, viewerUserId: string, canModerate: boolean): Promise<TradeInvoiceRow | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM trade_invoices WHERE tenant_id=$1 AND order_id=$2 AND ($3=true OR buyer_user_id=$4 OR seller_user_id=$4)`,
      [tenantId, orderId, canModerate, viewerUserId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }
}
