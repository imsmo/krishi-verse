// modules/dairy/repositories/milk-bill.repository.ts · all SQL for milk_bills. tenant_id in EVERY query
// (Law 1) + RLS. No version column → mutations lock FOR UPDATE. UNIQUE(membership_id, period_start,
// period_end) makes bill generation idempotent per cycle. Reads on replica; keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MilkBill, BillDeduction } from '../domain/milk-bill.entity';
import { BillStatus } from '../domain/milk-bill.state';

const COLS = `id, tenant_id, membership_id, period_start, period_end, total_litres, gross_minor, deductions, deductions_minor, net_minor, status, dispute_window_ends, payout_id, created_at`;
const d = (v: any): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): MilkBill {
  const deductions: BillDeduction[] = (r.deductions ?? []).map((x: any) => ({ type: x.type, amountMinor: BigInt(x.amount_minor ?? x.amountMinor ?? '0') }));
  return MilkBill.rehydrate({ id: r.id, tenantId: r.tenant_id, membershipId: r.membership_id, periodStart: d(r.period_start), periodEnd: d(r.period_end),
    totalLitresMilli: BigInt(Math.round(Number(r.total_litres) * 1000)), grossMinor: BigInt(r.gross_minor), deductions, deductionsMinor: BigInt(r.deductions_minor),
    netMinor: BigInt(r.net_minor), status: r.status as BillStatus, disputeWindowEnds: r.dispute_window_ends, payoutId: r.payout_id, createdAt: r.created_at });
}
const serializeDeductions = (ds: BillDeduction[]) => JSON.stringify(ds.map((x) => ({ type: x.type, amount_minor: x.amountMinor.toString() })));

@Injectable()
export class MilkBillRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, b: MilkBill): Promise<void> {
    const p = b.toProps();
    await tx.query(
      `INSERT INTO milk_bills (id, tenant_id, membership_id, period_start, period_end, total_litres, gross_minor, deductions, deductions_minor, net_minor, status, dispute_window_ends)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)`,
      [p.id, p.tenantId, p.membershipId, p.periodStart, p.periodEnd, (Number(p.totalLitresMilli) / 1000).toFixed(2), p.grossMinor.toString(),
       serializeDeductions(p.deductions), p.deductionsMinor.toString(), p.netMinor.toString(), p.status, p.disputeWindowEnds]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<MilkBill | null> {
    const r = await tx.query(`SELECT ${COLS} FROM milk_bills WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<MilkBill | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM milk_bills WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, b: MilkBill): Promise<void> {
    const p = b.toProps();
    await tx.query(`UPDATE milk_bills SET status=$3, payout_id=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.status, p.payoutId]);
  }
  async listFor(tenantId: string, q: { membershipIds?: string[]; membershipId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }): Promise<MilkBill[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.membershipId) where += ` AND membership_id=${p(q.membershipId)}`;
    if (q.membershipIds) where += ` AND membership_id = ANY(${p(q.membershipIds)})`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM milk_bills WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
