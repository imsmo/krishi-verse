// modules/education/read-models/crop-calendar.read-model.ts · editorial crop-agronomy calendars (P1-5, CQRS Law 12).
// Read-only over crop_calendars on the replica. Platform-global rows (tenant_id NULL) + the tenant's own are both
// visible under RLS. Optional crop/season/region filters; region_id resolved to a human name (bounded set).
// No fabrication: stages come straight from the stored editorial JSON; region name is null when the id doesn't resolve.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

export interface CropCalendarStage { name: string; dayFrom: number; dayTo: number; advisory: string | null }
export interface CropCalendar {
  id: string; cropName: string; season: string; regionId: string | null; regionName: string | null;
  durationDaysMin: number; durationDaysMax: number; stages: CropCalendarStage[]; source: string | null;
}

function toStages(v: unknown): CropCalendarStage[] {
  if (!Array.isArray(v)) return [];
  return v.map((s: any) => ({
    name: String(s?.name ?? ''),
    dayFrom: Number(s?.dayFrom ?? 0),
    dayTo: Number(s?.dayTo ?? 0),
    advisory: s?.advisory != null ? String(s.advisory) : null,
  })).filter((s) => s.name);
}

@Injectable()
export class CropCalendarReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** List active calendars (bounded). Optional filters; ordered crop then season. Region name resolved per page. */
  async list(tenantId: string, q: { crop?: string; season?: string; regionId?: string; limit?: number } = {}): Promise<CropCalendar[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `is_active AND deleted_at IS NULL`;
    if (q.crop) where += ` AND crop_name ILIKE ${p('%' + q.crop + '%')}`;
    if (q.season) where += ` AND season = ${p(q.season)}`;
    if (q.regionId) where += ` AND (region_id IS NULL OR region_id = ${p(q.regionId)})`;
    const lim = Math.max(1, Math.min(100, q.limit ?? 50));
    const db = this.replica.forTenant(tenantId);
    const r = await db.query<any>(
      `SELECT id, crop_name, season, region_id, duration_days_min, duration_days_max, stages, source
         FROM crop_calendars WHERE ${where} ORDER BY crop_name ASC, season ASC LIMIT ${lim}`, params);
    // Resolve region names for the (bounded) set of region ids referenced by this page.
    const regionIds = [...new Set(r.rows.map((x) => x.region_id).filter(Boolean))] as string[];
    const names: Record<string, string> = {};
    if (regionIds.length) {
      const nr = await db.query<{ id: string; default_name: string }>(`SELECT id, default_name FROM admin_regions WHERE id = ANY($1)`, [regionIds]);
      for (const row of nr.rows) names[row.id] = row.default_name;
    }
    return r.rows.map((x): CropCalendar => ({
      id: String(x.id), cropName: x.crop_name, season: x.season, regionId: x.region_id ?? null,
      regionName: x.region_id ? names[x.region_id] ?? null : null,
      durationDaysMin: Number(x.duration_days_min), durationDaysMax: Number(x.duration_days_max),
      stages: toStages(x.stages), source: x.source ?? null,
    }));
  }
}
