// modules/labour/repositories/minimum-wage.repository.ts · READ-ONLY resolution of the statutory floor.
// minimum_wages is GLOBAL master data (no tenant_id) seeded by db/seeds/rules. We resolve the row in
// effect on a given date for (region, skill_level) — the latest effective_from ≤ date. Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MinimumWage } from '../domain/minimum-wage.entity';
import { SkillLevel } from '../domain/labour.events';

const COLS = `id, region_id, skill_level, daily_wage_minor, hourly_wage_minor, overtime_multiplier, effective_from`;
function toDomain(r: any): MinimumWage {
  return MinimumWage.rehydrate({
    id: r.id, regionId: r.region_id, skillLevel: r.skill_level as SkillLevel,
    dailyWageMinor: BigInt(r.daily_wage_minor), hourlyWageMinor: r.hourly_wage_minor != null ? BigInt(r.hourly_wage_minor) : null,
    overtimeMultiplier: Number(r.overtime_multiplier), effectiveFrom: r.effective_from,
  });
}

@Injectable()
export class MinimumWageRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** The minimum-wage row in effect on `onDate` for (region, skill level), or null. Global (no tenant). */
  async resolve(tenantId: string, regionId: string, skillLevel: SkillLevel, onDate: string, tx?: TxContext): Promise<MinimumWage | null> {
    const sql = `SELECT ${COLS} FROM minimum_wages
                 WHERE region_id=$1 AND skill_level=$2 AND effective_from <= $3::date AND deleted_at IS NULL
                 ORDER BY effective_from DESC LIMIT 1`;
    const params = [regionId, skillLevel, onDate];
    const r = tx ? await tx.query(sql, params) : await this.replica.forTenant(tenantId).query(sql, params);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
}
