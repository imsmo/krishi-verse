// modules/logistics/domain/delivery-zone.entity.ts · a tenant's serviceability + charge zone (0007 delivery_zones).
// Pure TS — invariants only. Tenant-scoped (tenant_id NOT NULL). `pincodes` are 6-digit Indian PINs; `region_ids`
// reference geo regions. `charge_definition_id` (optional) links the zone to a buyer-delivery charge (payments
// owns charge_definitions — FK enforced by the DB, validated app-side via a typed error on violation). No money here.
import { InvalidDeliveryZoneError, FleetAlreadyInStateError } from './logistics.errors';
import type { DomainEvent } from './logistics.events';

const PINCODE_RE = /^[1-9][0-9]{5}$/;            // Indian PIN: 6 digits, no leading zero (anchored, ReDoS-safe)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const MAX_PINCODES = 5000;                        // bound write amplification / payload size
const MAX_REGIONS = 2000;

export interface DeliveryZoneProps {
  id: string; tenantId: string; defaultName: string; pincodes: string[]; regionIds: string[];
  chargeDefinitionId: string | null; isActive: boolean; createdAt?: Date | null;
}
export type DeliveryZonePatch = { defaultName?: string; pincodes?: string[]; regionIds?: string[]; chargeDefinitionId?: string | null };

function assertName(v: string): string {
  const s = v.trim();
  if (!s) throw new InvalidDeliveryZoneError('default_name is required');
  if (s.length > 120) throw new InvalidDeliveryZoneError('default_name exceeds 120 chars');
  if (/[<>]/.test(s) || CONTROL_RE.test(s)) throw new InvalidDeliveryZoneError('default_name must be plain text');
  return s;
}
function assertPincodes(raw: string[]): string[] {
  if (!Array.isArray(raw)) throw new InvalidDeliveryZoneError('pincodes must be an array');
  if (raw.length > MAX_PINCODES) throw new InvalidDeliveryZoneError(`pincodes exceeds ${MAX_PINCODES}`);
  const out: string[] = [];
  for (const p of raw) { const s = String(p).trim(); if (!PINCODE_RE.test(s)) throw new InvalidDeliveryZoneError(`invalid pincode: ${s}`); out.push(s); }
  return Array.from(new Set(out));               // de-dupe — a pincode belongs to a zone once
}
function assertRegionIds(raw: string[]): string[] {
  if (!Array.isArray(raw)) throw new InvalidDeliveryZoneError('region_ids must be an array');
  if (raw.length > MAX_REGIONS) throw new InvalidDeliveryZoneError(`region_ids exceeds ${MAX_REGIONS}`);
  const out: string[] = [];
  for (const r of raw) { const s = String(r).trim(); if (!UUID_RE.test(s)) throw new InvalidDeliveryZoneError(`invalid region_id: ${s}`); out.push(s); }
  return Array.from(new Set(out));
}

export class DeliveryZone {
  private readonly events: DomainEvent[] = [];
  private constructor(private p: DeliveryZoneProps) {}

  static create(input: Omit<DeliveryZoneProps, 'isActive' | 'pincodes' | 'regionIds'> & { pincodes: string[]; regionIds: string[] }): DeliveryZone {
    const z = new DeliveryZone({
      ...input, defaultName: assertName(input.defaultName), pincodes: assertPincodes(input.pincodes),
      regionIds: assertRegionIds(input.regionIds), isActive: true,
    });
    z.events.push({ type: 'logistics.delivery_zone_created', payload: { zoneId: z.p.id, tenantId: input.tenantId } });
    return z;
  }
  static rehydrate(p: DeliveryZoneProps): DeliveryZone { return new DeliveryZone(p); }

  get id() { return this.p.id; }
  get isActive() { return this.p.isActive; }
  /** Serviceability check used by checkout/quote flows. */
  servesPincode(pin: string): boolean { return this.p.isActive && this.p.pincodes.includes(String(pin).trim()); }
  toProps(): Readonly<DeliveryZoneProps> { return Object.freeze({ ...this.p, pincodes: [...this.p.pincodes], regionIds: [...this.p.regionIds] }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: DeliveryZonePatch): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.defaultName !== undefined) { const v = assertName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.pincodes !== undefined) { const v = assertPincodes(patch.pincodes); old.pincodes = this.p.pincodes.length; next.pincodes = v.length; this.p.pincodes = v; }
    if (patch.regionIds !== undefined) { const v = assertRegionIds(patch.regionIds); old.regionIds = this.p.regionIds.length; next.regionIds = v.length; this.p.regionIds = v; }
    if (patch.chargeDefinitionId !== undefined && patch.chargeDefinitionId !== this.p.chargeDefinitionId) { old.chargeDefinitionId = this.p.chargeDefinitionId; next.chargeDefinitionId = patch.chargeDefinitionId; this.p.chargeDefinitionId = patch.chargeDefinitionId; }
    if (Object.keys(next).length === 0) throw new FleetAlreadyInStateError('delivery_zone');
    return { old, new: next };
  }

  setActive(to: boolean): { action: 'activated' | 'deactivated'; old: { isActive: boolean }; new: { isActive: boolean } } {
    if (this.p.isActive === to) throw new FleetAlreadyInStateError('delivery_zone');
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'activated' : 'deactivated', old: { isActive: from }, new: { isActive: to } };
  }
}
