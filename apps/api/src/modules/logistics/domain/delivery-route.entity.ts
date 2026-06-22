// modules/logistics/domain/delivery-route.entity.ts · the Saturday Village Run (0007 delivery_routes, PRD §16.5):
// a tenant's recurring consolidation route to a cluster of village regions, optionally on a fixed weekday, served
// by a vehicle and dropped at a consolidation point (often an ambassador). Pure TS. Tenant-scoped. No money.
import { InvalidDeliveryRouteError, FleetAlreadyInStateError } from './logistics.errors';
import type { DomainEvent } from './logistics.events';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const MAX_REGIONS = 2000;

export interface DeliveryRouteProps {
  id: string; tenantId: string; defaultName: string; runWeekday: number | null; villageRegionIds: string[];
  vehicleId: string | null; consolidationUserId: string | null; isActive: boolean; createdAt?: Date | null;
}
export type DeliveryRoutePatch = { defaultName?: string; runWeekday?: number | null; villageRegionIds?: string[]; vehicleId?: string | null; consolidationUserId?: string | null };

function assertName(v: string): string {
  const s = v.trim();
  if (!s) throw new InvalidDeliveryRouteError('default_name is required');
  if (s.length > 150) throw new InvalidDeliveryRouteError('default_name exceeds 150 chars');
  if (/[<>]/.test(s) || CONTROL_RE.test(s)) throw new InvalidDeliveryRouteError('default_name must be plain text');
  return s;
}
function assertWeekday(d: number | null): number | null {
  if (d === null) return null;
  if (!Number.isInteger(d) || d < 0 || d > 6) throw new InvalidDeliveryRouteError('run_weekday must be an integer 0–6 or null');
  return d;
}
function assertRegionIds(raw: string[]): string[] {
  if (!Array.isArray(raw)) throw new InvalidDeliveryRouteError('village_region_ids must be an array');
  if (raw.length > MAX_REGIONS) throw new InvalidDeliveryRouteError(`village_region_ids exceeds ${MAX_REGIONS}`);
  const out: string[] = [];
  for (const r of raw) { const s = String(r).trim(); if (!UUID_RE.test(s)) throw new InvalidDeliveryRouteError(`invalid region_id: ${s}`); out.push(s); }
  return Array.from(new Set(out));
}

export class DeliveryRoute {
  private readonly events: DomainEvent[] = [];
  private constructor(private p: DeliveryRouteProps) {}

  static create(input: Omit<DeliveryRouteProps, 'isActive' | 'villageRegionIds'> & { villageRegionIds: string[] }): DeliveryRoute {
    const r = new DeliveryRoute({
      ...input, defaultName: assertName(input.defaultName), runWeekday: assertWeekday(input.runWeekday),
      villageRegionIds: assertRegionIds(input.villageRegionIds), isActive: true,
    });
    r.events.push({ type: 'logistics.delivery_route_created', payload: { routeId: r.p.id, tenantId: input.tenantId, runWeekday: r.p.runWeekday } });
    return r;
  }
  static rehydrate(p: DeliveryRouteProps): DeliveryRoute { return new DeliveryRoute(p); }

  get id() { return this.p.id; }
  get isActive() { return this.p.isActive; }
  get runWeekday() { return this.p.runWeekday; }
  toProps(): Readonly<DeliveryRouteProps> { return Object.freeze({ ...this.p, villageRegionIds: [...this.p.villageRegionIds] }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: DeliveryRoutePatch): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.defaultName !== undefined) { const v = assertName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.runWeekday !== undefined) { const v = assertWeekday(patch.runWeekday); if (v !== this.p.runWeekday) { old.runWeekday = this.p.runWeekday; next.runWeekday = v; this.p.runWeekday = v; } }
    if (patch.villageRegionIds !== undefined) { const v = assertRegionIds(patch.villageRegionIds); old.villageRegionIds = this.p.villageRegionIds.length; next.villageRegionIds = v.length; this.p.villageRegionIds = v; }
    if (patch.vehicleId !== undefined && patch.vehicleId !== this.p.vehicleId) { old.vehicleId = this.p.vehicleId; next.vehicleId = patch.vehicleId; this.p.vehicleId = patch.vehicleId; }
    if (patch.consolidationUserId !== undefined && patch.consolidationUserId !== this.p.consolidationUserId) { old.consolidationUserId = this.p.consolidationUserId; next.consolidationUserId = patch.consolidationUserId; this.p.consolidationUserId = patch.consolidationUserId; }
    if (Object.keys(next).length === 0) throw new FleetAlreadyInStateError('delivery_route');
    return { old, new: next };
  }

  setActive(to: boolean): { action: 'activated' | 'deactivated'; old: { isActive: boolean }; new: { isActive: boolean } } {
    if (this.p.isActive === to) throw new FleetAlreadyInStateError('delivery_route');
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'activated' : 'deactivated', old: { isActive: from }, new: { isActive: to } };
  }
}
