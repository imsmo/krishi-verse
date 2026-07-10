// modules/land-soil-weather/repositories/weather-prefs.repository.ts · per-user weather advisory prefs (P1-4).
// TENANT-scoped + user-owned + RLS (tenant_id in every query, Law 1). get reads the replica; upsert runs in the
// caller's UoW tx against the (tenant, user) partial-unique key. No PII.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export interface WeatherPrefs { morningAdvisory: boolean; weeklyOutlook: boolean; severeOnly: boolean }

const COLS = `morning_advisory, weekly_outlook, severe_only`;
function toDomain(r: any): WeatherPrefs {
  return { morningAdvisory: !!r.morning_advisory, weeklyOutlook: !!r.weekly_outlook, severeOnly: !!r.severe_only };
}

@Injectable()
export class WeatherPrefsRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** The caller's saved prefs, or null when they've never set any (service applies defaults). */
  async get(tenantId: string, userId: string): Promise<WeatherPrefs | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM weather_prefs WHERE tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`, [tenantId, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }

  /** Upsert the caller's prefs (one live row per tenant+user). Runs in the caller's UoW tx. */
  async upsert(tx: TxContext, tenantId: string, userId: string, p: WeatherPrefs): Promise<void> {
    await tx.query(
      `INSERT INTO weather_prefs (tenant_id, user_id, morning_advisory, weekly_outlook, severe_only, created_by)
         VALUES ($1,$2,$3,$4,$5,$2)
       ON CONFLICT (tenant_id, user_id) WHERE deleted_at IS NULL
       DO UPDATE SET morning_advisory=EXCLUDED.morning_advisory, weekly_outlook=EXCLUDED.weekly_outlook,
                     severe_only=EXCLUDED.severe_only, updated_at=now()`,
      [tenantId, userId, p.morningAdvisory, p.weeklyOutlook, p.severeOnly]);
  }
}
