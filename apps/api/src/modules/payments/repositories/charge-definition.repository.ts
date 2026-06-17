// modules/payments/repositories/charge-definition.repository.ts
// Resolves the effective charge definition for a charge_code. charge_definitions is hybrid:
// tenant_id NULL = platform default, set = tenant override (RLS: NULL OR current tenant). Every
// query binds tenant_id (Law 1); a tenant override beats the platform default; effective-dated.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ChargeCalcMethod } from '../domain/charge.calculator';

export interface ResolvedChargeDefinition { calcMethod: ChargeCalcMethod; config: Record<string, any>; }

@Injectable()
export class ChargeDefinitionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async resolve(tx: TxContext, tenantId: string, chargeCode: string, onDate?: string): Promise<ResolvedChargeDefinition | null> {
    const r = await tx.query<{ calc_method: ChargeCalcMethod; config: Record<string, any> }>(
      `SELECT calc_method, config FROM charge_definitions
        WHERE is_active = true AND charge_code = $2 AND (tenant_id = $1 OR tenant_id IS NULL)
          AND effective_from <= COALESCE($3::date, CURRENT_DATE)
          AND (effective_to IS NULL OR effective_to >= COALESCE($3::date, CURRENT_DATE))
        ORDER BY (tenant_id IS NOT NULL) DESC, effective_from DESC
        LIMIT 1`,
      [tenantId, chargeCode, onDate ?? null]);
    return r.rows[0] ? { calcMethod: r.rows[0].calc_method, config: r.rows[0].config } : null;
  }
}
