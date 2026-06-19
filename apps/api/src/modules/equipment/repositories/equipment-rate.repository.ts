// modules/equipment/repositories/equipment-rate.repository.ts · all SQL for equipment_rates. Asset-scoped
// (asset belongs to a tenant; access gated in the service). Resolves the ACTIVE effective-dated rate.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { EquipmentRate } from '../domain/equipment-rate.entity';
import { RateBasis } from '../domain/equipment.events';

const COLS = `id, asset_id, rate_basis, rate_minor, includes_operator, includes_fuel, effective_from, effective_to, created_at`;
const d = (v: any): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): EquipmentRate {
  return EquipmentRate.rehydrate({ id: r.id, assetId: r.asset_id, rateBasis: r.rate_basis as RateBasis, rateMinor: BigInt(r.rate_minor),
    includesOperator: r.includes_operator, includesFuel: r.includes_fuel, effectiveFrom: d(r.effective_from)!, effectiveTo: d(r.effective_to), createdAt: r.created_at });
}

@Injectable()
export class EquipmentRateRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  /** Idempotent upsert per (asset, basis, effective_from). */
  async upsert(tx: TxContext, r: EquipmentRate): Promise<void> {
    const p = r.toProps();
    await tx.query(
      `INSERT INTO equipment_rates (id, asset_id, rate_basis, rate_minor, includes_operator, includes_fuel, effective_from, effective_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (asset_id, rate_basis, effective_from) DO UPDATE SET rate_minor=EXCLUDED.rate_minor, includes_operator=EXCLUDED.includes_operator, includes_fuel=EXCLUDED.includes_fuel, effective_to=EXCLUDED.effective_to, updated_at=now()`,
      [p.id, p.assetId, p.rateBasis, p.rateMinor.toString(), p.includesOperator, p.includesFuel, p.effectiveFrom, p.effectiveTo]);
  }
  /** Active rate for an asset+basis on a date (latest effective_from ≤ date, window open). */
  async resolveActive(tx: TxContext, assetId: string, basis: string, onDate: string): Promise<EquipmentRate | null> {
    const r = await tx.query(
      `SELECT ${COLS} FROM equipment_rates WHERE asset_id=$1 AND rate_basis=$2 AND deleted_at IS NULL
        AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)
        ORDER BY effective_from DESC LIMIT 1`, [assetId, basis, onDate]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listByAsset(tenantId: string, assetId: string, activeOnly: boolean): Promise<EquipmentRate[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM equipment_rates WHERE asset_id=$1 AND deleted_at IS NULL ${activeOnly ? "AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)" : ''} ORDER BY rate_basis, effective_from DESC LIMIT 100`, [assetId]);
    return r.rows.map(toDomain);
  }
}
