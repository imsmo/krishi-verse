// apps/web-partner/src/features/logistics/fleet.ts · PURE helpers for the 3PL carrier profile + fleet (vehicles) +
// pickup slots. Mirrors apps/api logistics partners / vehicles / pickup-slots DTOs + read-models EXACTLY. No I/O,
// no React, no money. capacityKg is a WEIGHT (positive whole kg), parsed float-free (digit regex + unary `+`) —
// avoiding the float-coercion helpers the §4 audit forbids. Pickup times are HH:MM (24h); start must precede end (lexicographic compare is
// correct for zero-padded HH:MM).

// ---- partner kinds (mirror logistics-partner.entity PARTNER_KINDS) ----------------------------------------------
export const PARTNER_KINDS = ['3pl', 'tenant_fleet', 'rider'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export function isPartnerKind(v: string | undefined): v is PartnerKind {
  return !!v && (PARTNER_KINDS as readonly string[]).includes(v);
}
export function partnerKindKey(kind: string): string {
  return isPartnerKind(kind) ? `fleet.kind.${kind}` : 'fleet.kind.unknown';
}

// ---- weekdays + time ---------------------------------------------------------------------------------------------
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export function weekdayKey(d: number): string {
  return d >= 0 && d <= 6 ? `fleet.wd.${d}` : 'fleet.wd.unknown';
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class FleetError extends Error {
  constructor(public readonly fieldKey: string) { super(fieldKey); this.name = 'FleetError'; }
}

// ---- field validators --------------------------------------------------------------------------------------------
export function validName(raw: string): string {
  const v = (raw ?? '').trim();
  if (v.length < 1 || v.length > 150) throw new FleetError('name');
  return v;
}
/** providerCode is optional (2–60 chars), blank → null. */
export function parseProviderCode(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (v.length === 0) return null;
  if (v.length < 2 || v.length > 60) throw new FleetError('providerCode');
  return v;
}
/** Normalise a vehicle reg number: trim, collapse inner spaces, upper-case; 4–24 chars. */
export function normalizeRegNo(raw: string): string {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (v.length < 4 || v.length > 24) throw new FleetError('regNo');
  return v;
}
const DIGITS_RE = /^\d+$/;
/** Vehicle capacity in whole kilograms (1..100000); blank → null. Float-free (digit regex + unary `+`). */
export function parseCapacityKg(raw: string | undefined): number | null {
  const v = (raw ?? '').trim();
  if (v.length === 0) return null;
  if (!DIGITS_RE.test(v)) throw new FleetError('capacity');
  const n = +v;
  if (n < 1 || n > 100000) throw new FleetError('capacity');
  return n;
}
export function validTime(raw: string, key: string): string {
  const v = (raw ?? '').trim();
  if (!TIME_RE.test(v)) throw new FleetError(key);
  return v;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validUuid(raw: string, key: string): string {
  const v = (raw ?? '').trim();
  if (!UUID_RE.test(v)) throw new FleetError(key);
  return v;
}
export function parseWeekday(raw: string | undefined): Weekday {
  const v = (raw ?? '').trim();
  if (!DIGITS_RE.test(v)) throw new FleetError('weekday');
  const n = +v;
  if (n < 0 || n > 6) throw new FleetError('weekday');
  return n as Weekday;
}
/** Checkbox-style boolean (true/on/1/yes). */
export function parseBool(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === 'on' || v === '1' || v === 'yes';
}
/** activeOnly list filter — defaults true (the API default); explicit false includes inactive. */
export function parseActiveOnly(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'no');
}

// ---- builders (exact JSON bodies the API expects) ---------------------------------------------------------------
export interface CreatePartnerBody { partnerKind: PartnerKind; defaultName: string; providerCode: string | null; supportsColdChain: boolean; }
export function buildCreatePartner(f: { partnerKind: string; defaultName: string; providerCode?: string; supportsColdChain?: string }): CreatePartnerBody {
  if (!isPartnerKind(f.partnerKind)) throw new FleetError('partnerKind');
  return { partnerKind: f.partnerKind, defaultName: validName(f.defaultName), providerCode: parseProviderCode(f.providerCode), supportsColdChain: parseBool(f.supportsColdChain) };
}
export interface UpdatePartnerBody { defaultName?: string; providerCode?: string | null; supportsColdChain?: boolean; }
export function buildUpdatePartner(f: { defaultName?: string; providerCode?: string; supportsColdChain?: string }): UpdatePartnerBody {
  const body: UpdatePartnerBody = {};
  if (f.defaultName !== undefined && f.defaultName.trim() !== '') { body.defaultName = validName(f.defaultName); }
  if (f.providerCode !== undefined) body.providerCode = parseProviderCode(f.providerCode);
  if (f.supportsColdChain !== undefined) body.supportsColdChain = parseBool(f.supportsColdChain);
  if (Object.keys(body).length === 0) throw new FleetError('noChange');
  return body;
}

export interface CreateVehicleBody { partnerId: string; regNo: string; capacityKg: number | null; isRefrigerated: boolean; }
export function buildCreateVehicle(f: { partnerId: string; regNo: string; capacityKg?: string; isRefrigerated?: string }): CreateVehicleBody {
  return { partnerId: validUuid(f.partnerId, 'partnerId'), regNo: normalizeRegNo(f.regNo), capacityKg: parseCapacityKg(f.capacityKg), isRefrigerated: parseBool(f.isRefrigerated) };
}
export interface UpdateVehicleBody { capacityKg?: number | null; isRefrigerated?: boolean; }
export function buildUpdateVehicle(f: { capacityKg?: string; isRefrigerated?: string }): UpdateVehicleBody {
  const body: UpdateVehicleBody = {};
  if (f.capacityKg !== undefined) body.capacityKg = parseCapacityKg(f.capacityKg);
  if (f.isRefrigerated !== undefined) body.isRefrigerated = parseBool(f.isRefrigerated);
  if (Object.keys(body).length === 0) throw new FleetError('noChange');
  return body;
}

export interface SlotBody { weekday: Weekday; startTime: string; endTime: string; }
export function buildCreateSlot(f: { weekday: string; startTime: string; endTime: string }): SlotBody {
  const startTime = validTime(f.startTime, 'startTime');
  const endTime = validTime(f.endTime, 'endTime');
  if (startTime >= endTime) throw new FleetError('timeOrder'); // HH:MM lexicographic compare is correct
  return { weekday: parseWeekday(f.weekday), startTime, endTime };
}

export interface SetActiveBody { isActive: boolean; }
export function buildSetActive(isActive: boolean): SetActiveBody {
  return { isActive };
}

// ---- read-model types (mirror partner / vehicle / pickup-slot props) --------------------------------------------
export interface PartnerRow {
  id: string; partnerKind: string; providerCode: string | null; defaultName: string;
  riderUserId: string | null; supportsColdChain: boolean; isActive: boolean;
}
export interface VehicleRow {
  id: string; partnerId: string; regNo: string; vehicleTypeId: string | null;
  capacityKg: number | null; isRefrigerated: boolean; rcDocId: string | null; isActive: boolean;
}
export interface SlotRow {
  id: string; sellerUserId: string; weekday: number; startTime: string; endTime: string; isActive: boolean;
}
