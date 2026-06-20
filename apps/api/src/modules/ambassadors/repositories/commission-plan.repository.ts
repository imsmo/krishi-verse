// modules/ambassadors/repositories/commission-plan.repository.ts · commission_plans_ambassador (earning rules).
// resolveEffective prefers the tenant's own active plan for the event_code, else the platform default
// (tenant_id NULL), honouring effective_from/effective_to. Read-mostly; a tenant may add an override plan.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CommissionPlan } from '../domain/commission-plan.entity';

const COLS = `id, tenant_id, event_code, amount_minor, rate_bps, cap_minor, conditions, is_active`;
function toDomain(r: any): CommissionPlan {
  return CommissionPlan.rehydrate({ id: r.id, tenantId: r.tenant_id, eventCode: r.event_code, amountMinor: r.amount_minor != null ? BigInt(r.amount_minor) : null,
    rateBps: r.rate_bps, capMinor: r.cap_minor != null ? BigInt(r.cap_minor) : null, conditions: r.conditions ?? {}, isActive: r.is_active });
}
@Injectable()
export class CommissionPlanRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  /** Effective plan for an event: tenant override first, then platform default. Within the effective window. */
  async resolveEffective(tenantId: string, eventCode: string, tx?: TxContext): Promise<CommissionPlan | null> {
    const sql = `SELECT ${COLS} FROM commission_plans_ambassador
       WHERE event_code=$1 AND is_active=true AND deleted_at IS NULL AND (tenant_id=$2 OR tenant_id IS NULL)
         AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY tenant_id NULLS LAST LIMIT 1`;
    const r = tx ? await tx.query(sql, [eventCode, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [eventCode, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listFor(tenantId: string): Promise<CommissionPlan[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM commission_plans_ambassador WHERE (tenant_id=$1 OR tenant_id IS NULL) AND deleted_at IS NULL ORDER BY event_code, tenant_id NULLS LAST`, [tenantId]);
    return r.rows.map(toDomain);
  }
}
