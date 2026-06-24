// modules/ambassadors/repositories/ambassador-target.repository.ts · all SQL for ambassador_targets.
// tenant_id in EVERY query (Law 1) + RLS. target_value is bigint MINOR units for 'earnings_minor', else a
// count (Law 2). UNIQUE(ambassador_id, metric, period_start) is the no-duplicate-goal guard.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AmbassadorTarget } from '../domain/ambassador-target.entity';

const COLS = `id, tenant_id, ambassador_id, metric, period_start::text AS period_start, period_end::text AS period_end, target_value, created_at`;
function toDomain(r: any): AmbassadorTarget {
  return AmbassadorTarget.rehydrate({
    id: r.id, tenantId: r.tenant_id, ambassadorId: r.ambassador_id, metric: r.metric,
    periodStart: r.period_start, periodEnd: r.period_end, targetValue: BigInt(r.target_value), createdAt: r.created_at,
  });
}

@Injectable()
export class AmbassadorTargetRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, t: AmbassadorTarget): Promise<void> {
    const p = t.toProps();
    await tx.query(
      `INSERT INTO ambassador_targets (id, tenant_id, ambassador_id, metric, period_start, period_end, target_value, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$3)`,
      [p.id, p.tenantId, p.ambassadorId, p.metric, p.periodStart, p.periodEnd, p.targetValue.toString()]);
  }

  async existsFor(tx: TxContext, ambassadorId: string, metric: string, periodStart: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM ambassador_targets WHERE ambassador_id=$1 AND metric=$2 AND period_start=$3 AND deleted_at IS NULL`, [ambassadorId, metric, periodStart]);
    return (r.rowCount ?? 0) > 0;
  }

  /** An ambassador's targets, newest period first (bounded). */
  async listForAmbassador(tenantId: string, ambassadorId: string, limit: number): Promise<AmbassadorTarget[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM ambassador_targets WHERE tenant_id=$1 AND ambassador_id=$2 AND deleted_at IS NULL ORDER BY period_start DESC, id DESC LIMIT $3`,
      [tenantId, ambassadorId, limit]);
    return r.rows.map(toDomain);
  }
}
