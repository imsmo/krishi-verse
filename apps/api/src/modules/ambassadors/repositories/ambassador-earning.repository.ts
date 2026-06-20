// modules/ambassadors/repositories/ambassador-earning.repository.ts · ambassador_earnings (PARTITIONED by
// created_at; append-only). tenant_id in every query (Law 1) + RLS. Accrual idempotency is enforced in-service
// via existsFor (the table's UNIQUE includes created_at — the partition key — so it can't dedupe on its own).
// payout settle stamps payout_id; updates bind (id, created_at) so PG prunes to the row's partition (Law 8).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AmbassadorEarning } from '../domain/ambassador-earning.entity';

const COLS = `id, tenant_id, ambassador_id, plan_id, event_code, reference_type, reference_id, amount_minor, payout_id, created_at`;
function toDomain(r: any): AmbassadorEarning {
  return AmbassadorEarning.rehydrate({ id: r.id, tenantId: r.tenant_id, ambassadorId: r.ambassador_id, planId: r.plan_id, eventCode: r.event_code,
    referenceType: r.reference_type, referenceId: r.reference_id, amountMinor: BigInt(r.amount_minor), payoutId: r.payout_id, createdAt: r.created_at });
}
export interface EarningListQuery { unpaidOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AmbassadorEarningRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, e: AmbassadorEarning): Promise<void> {
    const p = e.toProps();
    await tx.query(
      `INSERT INTO ambassador_earnings (id, tenant_id, ambassador_id, plan_id, event_code, reference_type, reference_id, amount_minor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.id, p.tenantId, p.ambassadorId, p.planId, p.eventCode, p.referenceType, p.referenceId, p.amountMinor.toString()]);
  }
  /** Idempotency guard for accrual: has this (ambassador, event, reference) already been credited? */
  async existsFor(tx: TxContext, ambassadorId: string, eventCode: string, referenceId: string | null): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM ambassador_earnings WHERE ambassador_id=$1 AND event_code=$2 AND reference_id IS NOT DISTINCT FROM $3 LIMIT 1`, [ambassadorId, eventCode, referenceId]);
    return (r.rowCount ?? 0) > 0;
  }
  /** Unpaid earnings for an ambassador, locked for a payout batch (FOR UPDATE SKIP LOCKED, bounded). */
  async lockUnpaid(tx: TxContext, tenantId: string, ambassadorId: string, max = 1000): Promise<AmbassadorEarning[]> {
    const r = await tx.query(`SELECT ${COLS} FROM ambassador_earnings WHERE tenant_id=$1 AND ambassador_id=$2 AND payout_id IS NULL ORDER BY created_at LIMIT ${max} FOR UPDATE SKIP LOCKED`, [tenantId, ambassadorId]);
    return r.rows.map(toDomain);
  }
  async markPaid(tx: TxContext, ids: { id: string; createdAt: Date }[], payoutId: string): Promise<void> {
    for (const it of ids) await tx.query(`UPDATE ambassador_earnings SET payout_id=$3 WHERE id=$1 AND created_at=$2 AND payout_id IS NULL`, [it.id, it.createdAt, payoutId]);
  }
  async listForAmbassador(tenantId: string, ambassadorId: string, q: EarningListQuery): Promise<AmbassadorEarning[]> {
    const params: unknown[] = [tenantId, ambassadorId]; let where = `tenant_id=$1 AND ambassador_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.unpaidOnly) where += ` AND payout_id IS NULL`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ambassador_earnings WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
