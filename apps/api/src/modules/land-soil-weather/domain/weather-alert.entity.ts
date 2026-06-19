// modules/land-soil-weather/domain/weather-alert.entity.ts · read-only VO for weather_alerts.
// GLOBAL region-scoped advisories (no tenant_id) ingested from IMD/Skymet on the platform pipeline (Law 11);
// this tenant-facing module only READS them. Partitioned by created_at.
export interface WeatherAlertProps {
  id: string; regionId: string; alertTypeId: string; severity: string; validFrom: Date; validTo: Date; advisoryTextKey: string | null; payload: Record<string, unknown>; source: string; createdAt?: Date;
}
export class WeatherAlert {
  private constructor(private readonly props: WeatherAlertProps) {}
  static rehydrate(p: WeatherAlertProps): WeatherAlert { return new WeatherAlert(p); }
  get id() { return this.props.id; }
  toJSON() { const v = this.props; return { id: v.id, regionId: v.regionId, alertTypeId: v.alertTypeId, severity: v.severity, validFrom: v.validFrom, validTo: v.validTo, advisoryTextKey: v.advisoryTextKey, payload: v.payload, source: v.source, createdAt: v.createdAt }; }
}
