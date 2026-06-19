// modules/land-soil-weather/repositories/weather-alert.repository.ts · READ-ONLY weather_alerts.
// GLOBAL region-scoped advisories (no tenant_id) ingested on the platform pipeline (Law 11); partitioned by
// created_at. The active-alerts query bounds created_at to the last 30 days so PG prunes to recent
// partitions (Law 8) — advisories older than that have lapsed anyway. Reads on the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { WeatherAlert } from '../domain/weather-alert.entity';

const COLS = `id, region_id, alert_type_id, severity, valid_from, valid_to, advisory_text_key, payload, source, created_at`;
function toDomain(r: any): WeatherAlert {
  return WeatherAlert.rehydrate({ id: r.id, regionId: r.region_id, alertTypeId: r.alert_type_id, severity: r.severity, validFrom: r.valid_from, validTo: r.valid_to, advisoryTextKey: r.advisory_text_key, payload: r.payload ?? {}, source: r.source, createdAt: r.created_at });
}
@Injectable()
export class WeatherAlertRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  /** Alerts for a region. activeOnly = currently valid; bounded created_at window prunes partitions. */
  async listForRegion(tenantId: string, regionId: string, activeOnly: boolean, limit: number): Promise<WeatherAlert[]> {
    const params: unknown[] = [regionId];
    // created_at lower bound prunes the partitioned scan to recent months (active alerts are recent).
    let where = `region_id=$1 AND created_at >= now() - interval '30 days'`;
    if (activeOnly) where += ` AND valid_from <= now() AND valid_to >= now()`;
    params.push(limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM weather_alerts WHERE ${where} ORDER BY valid_to DESC, id DESC LIMIT $2`, params);
    return r.rows.map(toDomain);
  }
}
