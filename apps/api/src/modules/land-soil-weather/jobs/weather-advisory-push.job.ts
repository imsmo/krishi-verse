// modules/land-soil-weather/jobs/weather-advisory-push.job.ts · worker job: push newly-active regional weather
// advisories. For each weather_alert that became active recently and hasn't been announced yet, emit ONE
// 'land.weather_advisory_active' outbox event (the communication fan-out then delivers it per the region's users'
// channel prefs + quiet hours — Law 11 keeps ingestion/fan-out on the platform pipeline). Idempotent (dedups
// against an already-emitted outbox row for the same alert) + bounded (LIMIT). Emits nothing it can't ground in a
// real ingested alert — never fabricates weather.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';

@Injectable()
export class WeatherAdvisoryPushJob {
  private readonly log = new Logger(WeatherAdvisoryPushJob.name);
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  /** Announce alerts that turned active within the last `windowMin` minutes and aren't already announced. */
  async runForTenant(tenantId: string, windowMin = 30): Promise<number> {
    return this.uow.run(tenantId, async (tx) => {
      // weather_alerts is GLOBAL ingested reference data (no tenant_id); the created_at lower bound prunes the
      // partitioned scan. We only announce alerts that just became active and have no prior advisory outbox row.
      const due = await tx.query<{ id: string; region_id: string; alert_type_id: string; severity: string; valid_to: Date }>(
        `SELECT a.id, a.region_id, a.alert_type_id, a.severity, a.valid_to
           FROM weather_alerts a
          WHERE a.created_at >= now() - interval '30 days'
            AND a.valid_from <= now() AND a.valid_to >= now()
            AND a.valid_from >= now() - ($2 || ' minutes')::interval
            AND NOT EXISTS (
              SELECT 1 FROM outbox_events o
               WHERE o.aggregate_type = 'weather_alert' AND o.aggregate_id = a.id
                 AND o.event_type = 'land.weather_advisory_active')
          ORDER BY a.valid_to DESC
          LIMIT 200`, [tenantId, String(windowMin)]);
      for (const a of due.rows) {
        await this.outbox.write(tx, {
          tenantId, aggregateType: 'weather_alert', aggregateId: a.id, eventType: 'land.weather_advisory_active',
          payload: { v: 1, regionId: a.region_id, alertTypeId: a.alert_type_id, severity: a.severity, validTo: a.valid_to },
        });
      }
      if (due.rows.length) this.log.log(`queued ${due.rows.length} weather advisories for tenant ${tenantId}`);
      return due.rows.length;
    });
  }
}
