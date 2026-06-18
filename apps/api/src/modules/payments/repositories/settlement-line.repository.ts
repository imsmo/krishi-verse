// modules/payments/repositories/settlement-line.repository.ts
// Per-order settlement breakdown (seller-tagged) — the source the statement generator aggregates.
// Written at settlement (in the relay/settlement tx); idempotent per order. tenant_id in EVERY
// query (Law 1); RLS is the net. bigint minor units only.
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';

export interface SettlementLineInput {
  tenantId: string; sellerUserId: string; orderId: string;
  grossMinor: bigint; commissionMinor: bigint; gstMinor: bigint; tdsMinor: bigint; netMinor: bigint;
  tenantCommissionMinor?: bigint; platformFeesMinor?: bigint;   // breakdown for precise dispute-refund reversal
}
export interface SellerPeriodAggregate { grossMinor: bigint; commissionMinor: bigint; taxMinor: bigint; netMinor: bigint; lineCount: number; }

@Injectable()
export class SettlementLineRepository {
  /** Idempotent insert (one line per order) within the caller's tx. */
  async insert(tx: TxContext, l: SettlementLineInput): Promise<void> {
    await tx.query(
      `INSERT INTO settlement_lines (tenant_id, seller_user_id, order_id, gross_minor, commission_minor, gst_minor, tds_minor, net_minor, tenant_commission_minor, platform_fees_minor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, order_id) DO NOTHING`,
      [l.tenantId, l.sellerUserId, l.orderId, l.grossMinor.toString(), l.commissionMinor.toString(), l.gstMinor.toString(), l.tdsMinor.toString(), l.netMinor.toString(), (l.tenantCommissionMinor ?? 0n).toString(), (l.platformFeesMinor ?? 0n).toString()]);
  }

  /** The settlement line for an order (or null) — the source for a precise dispute-refund reversal. */
  async findByOrder(tx: TxContext, tenantId: string, orderId: string): Promise<{ sellerUserId: string; grossMinor: bigint; commissionMinor: bigint; gstMinor: bigint; tdsMinor: bigint; netMinor: bigint; tenantCommissionMinor: bigint; platformFeesMinor: bigint; statementId: string | null } | null> {
    const r = await tx.query(
      `SELECT seller_user_id, gross_minor, commission_minor, gst_minor, tds_minor, net_minor, tenant_commission_minor, platform_fees_minor, statement_id
         FROM settlement_lines WHERE tenant_id=$1 AND order_id=$2`, [tenantId, orderId]);
    const x = r.rows[0];
    if (!x) return null;
    return { sellerUserId: x.seller_user_id, grossMinor: BigInt(x.gross_minor), commissionMinor: BigInt(x.commission_minor),
      gstMinor: BigInt(x.gst_minor), tdsMinor: BigInt(x.tds_minor), netMinor: BigInt(x.net_minor),
      tenantCommissionMinor: BigInt(x.tenant_commission_minor), platformFeesMinor: BigInt(x.platform_fees_minor), statementId: x.statement_id ?? null };
  }
  /** Remove an order's settlement line when reversing it (only while NOT yet rolled into a statement). */
  async deleteByOrder(tx: TxContext, tenantId: string, orderId: string): Promise<number> {
    const r = await tx.query(`DELETE FROM settlement_lines WHERE tenant_id=$1 AND order_id=$2 AND statement_id IS NULL`, [tenantId, orderId]);
    return r.rowCount ?? 0;
  }

  /** Aggregate the seller's UN-statemented lines in [from, to) — FOR UPDATE so generation is atomic. */
  async aggregateOpenForUpdate(tx: TxContext, tenantId: string, sellerUserId: string, from: string, to: string): Promise<SellerPeriodAggregate> {
    const r = await tx.query<any>(
      `SELECT COALESCE(SUM(gross_minor),0)::text gross, COALESCE(SUM(commission_minor),0)::text commission,
              COALESCE(SUM(gst_minor + tds_minor),0)::text tax, COALESCE(SUM(net_minor),0)::text net, count(*)::int n
         FROM settlement_lines
        WHERE tenant_id=$1 AND seller_user_id=$2 AND statement_id IS NULL
          AND created_at >= $3::timestamptz AND created_at < $4::timestamptz
        FOR UPDATE`,
      [tenantId, sellerUserId, from, to]);
    const row = r.rows[0];
    return { grossMinor: BigInt(row.gross), commissionMinor: BigInt(row.commission), taxMinor: BigInt(row.tax), netMinor: BigInt(row.net), lineCount: row.n };
  }

  /** Attach the generated statement to its lines (so they aren't double-counted next cycle). */
  async linkToStatement(tx: TxContext, tenantId: string, sellerUserId: string, from: string, to: string, statementId: string): Promise<number> {
    const r = await tx.query(
      `UPDATE settlement_lines SET statement_id=$5
        WHERE tenant_id=$1 AND seller_user_id=$2 AND statement_id IS NULL AND created_at >= $3::timestamptz AND created_at < $4::timestamptz`,
      [tenantId, sellerUserId, from, to, statementId]);
    return r.rowCount ?? 0;
  }
}
