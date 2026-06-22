// modules/tenancy/repositories/saas-invoice.repository.ts · SQL for saas_invoices (0002 + 0035 dunning cols).
// tenant_id in EVERY query (Law 1) + RLS. No version col → mutations lock the row FOR UPDATE. invoice_no comes
// from next_doc_number() inside the tx (gap-free per tenant). Reads on the replica; keyset on (created_at, id).
// Money is bigint minor units (stringified on the wire). The renewal worker uses SKIP LOCKED across tenants.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext, SqlExecutor } from '../../../core/database/unit-of-work';
import { SaasInvoice, SaasInvoiceLine } from '../domain/saas-invoice.entity';
import { InvoiceStatus } from '../domain/saas-invoice.state';

const COLS = `id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor, due_date, paid_at, line_items, dunning_attempts, created_at`;
const big = (v: any) => BigInt(v);
const ymd = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

function toLines(raw: any): SaasInvoiceLine[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((l: any) => ({ desc: String(l.desc), qty: Number(l.qty), unitMinor: big(l.unitMinor ?? l.unit_minor ?? 0), totalMinor: big(l.totalMinor ?? l.total_minor ?? 0) }));
}
function toDomain(r: any): SaasInvoice {
  return SaasInvoice.rehydrate({
    id: r.id, tenantId: r.tenant_id, subscriptionId: r.subscription_id, invoiceNo: r.invoice_no, status: r.status as InvoiceStatus,
    currencyCode: r.currency_code, subtotalMinor: big(r.subtotal_minor), taxMinor: big(r.tax_minor), totalMinor: big(r.total_minor),
    dueDate: ymd(r.due_date), paidAt: r.paid_at, lineItems: toLines(r.line_items), dunningAttempts: r.dunning_attempts ?? 0, createdAt: r.created_at,
  });
}
function lineToJson(l: SaasInvoiceLine) { return { desc: l.desc, qty: l.qty, unit_minor: l.unitMinor.toString(), total_minor: l.totalMinor.toString() }; }

export interface InvoiceListQuery { allTenants?: boolean; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class SaasInvoiceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Allocate a gap-free invoice number for the tenant within the tx. */
  async nextInvoiceNo(tx: TxContext, tenantId: string, period: string): Promise<string> {
    const r = await tx.query(`SELECT next_doc_number($1,'saas_invoice','SINV',$2) AS no`, [tenantId, period]);
    return (r.rows[0] as any).no as string;
  }

  async insert(tx: TxContext, inv: SaasInvoice): Promise<void> {
    const p = inv.toProps();
    await tx.query(
      `INSERT INTO saas_invoices (id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor, due_date, paid_at, line_items, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12::jsonb, now())`,
      [p.id, p.tenantId, p.subscriptionId, p.invoiceNo, p.status, p.currencyCode, p.subtotalMinor.toString(), p.taxMinor.toString(), p.totalMinor.toString(), p.dueDate, p.paidAt, JSON.stringify(p.lineItems.map(lineToJson))]);
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<SaasInvoice | null> {
    const r = await tx.query(`SELECT ${COLS} FROM saas_invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<SaasInvoice | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM saas_invoices WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Status + paid_at update (status moves via the entity's state machine; dunning_attempts is billing-ops' column). */
  async update(tx: TxContext, inv: SaasInvoice): Promise<void> {
    const p = inv.toProps();
    await tx.query(`UPDATE saas_invoices SET status=$3, paid_at=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [p.id, p.tenantId, p.status, p.paidAt]);
  }

  /** Idempotency guard for the renewal run: is there already an invoice for this subscription + billing period? */
  async existsForPeriod(tx: TxContext, tenantId: string, subscriptionId: string, periodTag: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM saas_invoices WHERE tenant_id=$1 AND subscription_id=$2 AND invoice_no LIKE '%'||$3||'%' LIMIT 1`, [tenantId, subscriptionId, periodTag]);
    return (r.rowCount ?? 0) > 0;
  }

  async list(tenantId: string, q: InvoiceListQuery): Promise<SaasInvoice[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = q.allTenants ? `1=1` : `tenant_id=$1`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM saas_invoices WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** Worker finder (cross-tenant; kv_relay): owing invoices past due_date → mark overdue. Bounded + SKIP LOCKED. */
  async findOwingPastDue(tx: SqlExecutor, asOf: string, limit: number): Promise<Array<{ id: string; tenantId: string }>> {
    const r = await tx.query(
      `SELECT id, tenant_id FROM saas_invoices WHERE status IN ('issued','partially_paid') AND due_date < $1::date
        ORDER BY due_date LIMIT $2 FOR UPDATE SKIP LOCKED`, [asOf, limit]);
    return r.rows.map((x: any) => ({ id: x.id, tenantId: x.tenant_id }));
  }
}
