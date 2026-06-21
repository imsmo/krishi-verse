// apps/admin-api/src/modules/billing-ops/repositories/billing.repository.ts · ALL SQL for billing-ops. READS:
// saas_invoices (keyset list + single + FOR UPDATE), dunning attempts (keyset), billing_adjustments (keyset +
// by-idempotency-key), and the revenue rollup over subscriptions/saas_invoices. WRITES (in the caller's tx):
// invoice status transition, dunning attempt + counter bump, billing_adjustment record. It NEVER touches
// ledger_entries/ledger_transactions/wallet_accounts — money moves only via the wallet-service (Law 2/9). Money
// is bigint, surfaced as STRING minor units (never floated). Parameterised only; keyset (never OFFSET); bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { SaasInvoice } from '../domain/invoice.entity';
import { InvoiceStatus } from '../domain/invoice.state';

function toInvoice(r: any): SaasInvoice {
  return SaasInvoice.rehydrate({
    id: r.id, tenantId: r.tenant_id, subscriptionId: r.subscription_id ?? null, invoiceNo: r.invoice_no,
    status: r.status as InvoiceStatus, currencyCode: r.currency_code,
    subtotalMinor: BigInt(r.subtotal_minor), taxMinor: BigInt(r.tax_minor), totalMinor: BigInt(r.total_minor),
    dueDate: r.due_date, paidAt: r.paid_at ?? null, dunningAttempts: r.dunning_attempts ?? 0,
    lastDunnedAt: r.last_dunned_at ?? null, createdAt: r.created_at ?? null,
  });
}

export interface InvoiceListQuery { tenantId?: string; status?: InvoiceStatus; cursor?: { c: string; id: string }; limit: number; }
export interface AdjustmentListQuery { tenantId?: string; cursor?: { c: string; id: string }; limit: number; }
export interface DunningListQuery { invoiceId: string; cursor?: { c: string; id: string }; limit: number; }

export interface AdjustmentRow {
  id: string; tenantId: string; subscriptionId: string | null; invoiceId: string | null;
  direction: string; amountMinor: string; currency: string; reason: string; walletTxnId: string; createdAt: Date | null;
}
function toAdjustment(r: any): AdjustmentRow {
  return { id: r.id, tenantId: r.tenant_id, subscriptionId: r.subscription_id ?? null, invoiceId: r.invoice_id ?? null,
    direction: r.direction, amountMinor: String(r.amount_minor), currency: r.currency_code, reason: r.reason,
    walletTxnId: r.wallet_txn_id, createdAt: r.created_at ?? null };
}

@Injectable()
export class BillingRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ---------------- saas_invoices ---------------- */
  async listInvoices(q: InvoiceListQuery): Promise<SaasInvoice[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.tenantId) where += ` AND tenant_id=${p(q.tenantId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor,
              due_date, paid_at, dunning_attempts, last_dunned_at, created_at
         FROM saas_invoices WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toInvoice);
  }

  async getInvoice(id: string): Promise<SaasInvoice | null> {
    const r = await this.pool.query(
      `SELECT id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor,
              due_date, paid_at, dunning_attempts, last_dunned_at, created_at
         FROM saas_invoices WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toInvoice(r.rows[0]) : null;
  }

  async getInvoiceForUpdate(client: PoolClient, id: string): Promise<SaasInvoice | null> {
    const r = await client.query(
      `SELECT id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor,
              due_date, paid_at, dunning_attempts, last_dunned_at, created_at
         FROM saas_invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toInvoice(r.rows[0]) : null;
  }

  async updateInvoiceStatus(client: PoolClient, id: string, status: InvoiceStatus, actorUserId: string): Promise<void> {
    await client.query(`UPDATE saas_invoices SET status=$2, updated_by=$3, updated_at=now() WHERE id=$1`, [id, status, actorUserId]);
  }

  /* ---------------- dunning ---------------- */
  async insertDunningAttempt(client: PoolClient, a: { invoiceId: string; tenantId: string; attemptNo: number; channel: string; outcome: string; note: string | null; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO saas_invoice_dunning_attempts (invoice_id, tenant_id, attempt_no, channel, outcome, note, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.invoiceId, a.tenantId, a.attemptNo, a.channel, a.outcome, a.note, a.actorUserId]);
  }
  async bumpInvoiceDunning(client: PoolClient, invoiceId: string, attemptNo: number): Promise<void> {
    await client.query(`UPDATE saas_invoices SET dunning_attempts=$2, last_dunned_at=now() WHERE id=$1`, [invoiceId, attemptNo]);
  }
  async listDunning(q: DunningListQuery): Promise<any[]> {
    const params: unknown[] = [q.invoiceId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'invoice_id=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, invoice_id, attempt_no, channel, outcome, note, actor_user_id, created_at
         FROM saas_invoice_dunning_attempts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, invoiceId: x.invoice_id, attemptNo: x.attempt_no, channel: x.channel, outcome: x.outcome, note: x.note ?? null, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }

  /* ---------------- billing_adjustments ---------------- */
  async tenantExists(tenantId: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM tenants WHERE id=$1`, [tenantId]);
    return (r.rowCount ?? 0) > 0;
  }
  async getAdjustmentByKey(idempotencyKey: string): Promise<AdjustmentRow | null> {
    const r = await this.pool.query(
      `SELECT id, tenant_id, subscription_id, invoice_id, direction, amount_minor, currency_code, reason, wallet_txn_id, created_at
         FROM billing_adjustments WHERE idempotency_key=$1`, [idempotencyKey]);
    return r.rows[0] ? toAdjustment(r.rows[0]) : null;
  }
  /** Insert the applied-adjustment record. Idempotent: a concurrent duplicate key yields the existing row. */
  async insertAdjustment(client: PoolClient, a: { id: string; tenantId: string; subscriptionId: string | null; invoiceId: string | null; direction: string; amountMinor: bigint; currency: string; reason: string; idempotencyKey: string; walletTxnId: string; actorUserId: string }): Promise<AdjustmentRow> {
    const r = await client.query(
      `INSERT INTO billing_adjustments (id, tenant_id, subscription_id, invoice_id, direction, amount_minor, currency_code, reason, idempotency_key, wallet_txn_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, tenant_id, subscription_id, invoice_id, direction, amount_minor, currency_code, reason, wallet_txn_id, created_at`,
      [a.id, a.tenantId, a.subscriptionId, a.invoiceId, a.direction, a.amountMinor.toString(), a.currency, a.reason, a.idempotencyKey, a.walletTxnId, a.actorUserId]);
    if (r.rows[0]) return toAdjustment(r.rows[0]);
    const existing = await client.query(
      `SELECT id, tenant_id, subscription_id, invoice_id, direction, amount_minor, currency_code, reason, wallet_txn_id, created_at
         FROM billing_adjustments WHERE idempotency_key=$1`, [a.idempotencyKey]);
    return toAdjustment(existing.rows[0]);
  }
  async listAdjustments(q: AdjustmentListQuery): Promise<AdjustmentRow[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.tenantId) where += ` AND tenant_id=${p(q.tenantId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, tenant_id, subscription_id, invoice_id, direction, amount_minor, currency_code, reason, wallet_txn_id, created_at
         FROM billing_adjustments WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toAdjustment);
  }

  /* ---------------- revenue rollup (read-only; float-free in SQL) ---------------- */
  async revenueRollup(currency: string, fromIso?: string, toIso?: string): Promise<{ mrrMinor: string; activeSubscriptions: number; outstandingMinor: string; collectedMinor: string; statusCounts: Record<string, number> }> {
    const subs = await this.pool.query(
      `SELECT COALESCE(SUM(CASE WHEN billing_cycle='annual' THEN price_minor/12 ELSE price_minor END),0)::text AS mrr,
              COUNT(*)::int AS active
         FROM subscriptions WHERE status IN ('active','trialing') AND currency_code=$1 AND deleted_at IS NULL`, [currency]);
    const outstanding = await this.pool.query(
      `SELECT COALESCE(SUM(total_minor),0)::text AS s FROM saas_invoices
         WHERE status IN ('issued','partially_paid','overdue') AND currency_code=$1 AND deleted_at IS NULL`, [currency]);
    const collected = await this.pool.query(
      `SELECT COALESCE(SUM(total_minor),0)::text AS s FROM saas_invoices
         WHERE status='paid' AND currency_code=$1 AND deleted_at IS NULL
           AND ($2::timestamptz IS NULL OR paid_at >= $2) AND ($3::timestamptz IS NULL OR paid_at < $3)`,
      [currency, fromIso ?? null, toIso ?? null]);
    const counts = await this.pool.query(
      `SELECT status, COUNT(*)::int AS n FROM saas_invoices WHERE currency_code=$1 AND deleted_at IS NULL GROUP BY status`, [currency]);
    const statusCounts: Record<string, number> = {};
    for (const row of counts.rows) statusCounts[row.status] = row.n;
    return {
      mrrMinor: String(subs.rows[0]?.mrr ?? '0'), activeSubscriptions: subs.rows[0]?.active ?? 0,
      outstandingMinor: String(outstanding.rows[0]?.s ?? '0'), collectedMinor: String(collected.rows[0]?.s ?? '0'), statusCounts,
    };
  }
}
