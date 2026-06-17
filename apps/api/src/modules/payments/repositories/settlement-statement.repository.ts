// modules/payments/repositories/settlement-statement.repository.ts
// Seller settlement statements (per seller per cycle). tenant_id in EVERY query (Law 1) + RLS.
// statement_no is GST-style sequential via next_doc_number(). Reads off the replica; writes in tx.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export interface SettlementStatementRow {
  id: string; statementNo: string; sellerUserId: string; periodStart: string; periodEnd: string;
  grossMinor: string; commissionMinor: string; taxMinor: string; netMinor: string; pdfMediaId: string | null; createdAt: Date;
}
const COLS = `id, statement_no, seller_user_id, period_start, period_end, gross_minor, commission_minor, tax_minor, net_minor, pdf_media_id, created_at`;
function toRow(r: any): SettlementStatementRow {
  return { id: r.id, statementNo: r.statement_no, sellerUserId: r.seller_user_id, periodStart: r.period_start, periodEnd: r.period_end,
    grossMinor: String(r.gross_minor), commissionMinor: String(r.commission_minor), taxMinor: String(r.tax_minor), netMinor: String(r.net_minor), pdfMediaId: r.pdf_media_id ?? null, createdAt: r.created_at };
}

@Injectable()
export class SettlementStatementRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Existing statement for a seller+period (idempotent generation guard). */
  async findForPeriod(tx: TxContext, tenantId: string, sellerUserId: string, from: string, to: string): Promise<SettlementStatementRow | null> {
    const r = await tx.query(`SELECT ${COLS} FROM settlement_statements WHERE tenant_id=$1 AND seller_user_id=$2 AND period_start=$3::date AND period_end=$4::date`, [tenantId, sellerUserId, from, to]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  /** GST-style sequential statement number (atomic, per tenant). */
  async nextNumber(tx: TxContext, tenantId: string, period: string): Promise<string> {
    const r = await tx.query<{ n: string }>(`SELECT next_doc_number($1,'settlement','STMT',$2) n`, [tenantId, period]);
    return r.rows[0].n;
  }

  async insert(tx: TxContext, s: { id: string; tenantId: string; sellerUserId: string; statementNo: string; from: string; to: string; grossMinor: bigint; commissionMinor: bigint; taxMinor: bigint; netMinor: bigint }): Promise<void> {
    await tx.query(
      `INSERT INTO settlement_statements (id, tenant_id, seller_user_id, statement_no, period_start, period_end, gross_minor, commission_minor, tax_minor, net_minor)
       VALUES ($1,$2,$3,$4,$5::date,$6::date,$7,$8,$9,$10)`,
      [s.id, s.tenantId, s.sellerUserId, s.statementNo, s.from, s.to, s.grossMinor.toString(), s.commissionMinor.toString(), s.taxMinor.toString(), s.netMinor.toString()]);
  }

  /** Attach the rendered PDF media id (tenant-scoped). */
  async setPdfMediaId(tx: TxContext, tenantId: string, id: string, mediaId: string): Promise<void> {
    await tx.query(`UPDATE settlement_statements SET pdf_media_id=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, tenantId, mediaId]);
  }

  /** Statement visible to its seller, or to a finance moderator (404 otherwise — no enumeration). */
  async getVisible(tenantId: string, id: string, viewerUserId: string, canModerate: boolean): Promise<SettlementStatementRow | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM settlement_statements WHERE id=$1 AND tenant_id=$2 AND ($3=true OR seller_user_id=$4)`, [id, tenantId, canModerate, viewerUserId]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  async listForSeller(tenantId: string, sellerUserId: string, opts: { cursor?: { c: string; id: string }; limit: number }): Promise<SettlementStatementRow[]> {
    const params: unknown[] = [tenantId, sellerUserId];
    let where = `tenant_id=$1 AND seller_user_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.cursor) { const cc = p(opts.cursor.c), ci = p(opts.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(opts.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM settlement_statements WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toRow);
  }
}
