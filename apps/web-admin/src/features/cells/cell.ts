// apps/web-admin/src/features/cells/cell.ts · PURE cell/shard/placement helpers for the god-mode cells console.
// Mirrors admin-api cells-ops EXACTLY (controller `cells`; node.state machine; cells-ops.dto zod shapes; cell/shard
// entity toJSON read-models). No I/O, no React, no money. CRITICAL (§4 + Law 11): a shard's `dsn_secret_ref` is a
// VAULT reference that admin-api NEVER emits — toJSON exposes only `hasDsn`. This module therefore models `hasDsn`
// only and never carries, parses, or surfaces a raw DSN. Numeric parses are float-free (digit-regex + unary `+`),
// avoiding the float-coercion helpers the §4 audit forbids (Law 2 discipline even where there is no money).

// ---- node state machine (mirror domain/node.state.ts) -----------------------------------------------------------
export const NODE_STATUSES = ['active', 'draining', 'readonly', 'retired'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

const NODE_TRANSITIONS: Record<NodeStatus, readonly NodeStatus[]> = {
  active: ['readonly', 'draining'],
  readonly: ['active', 'draining'],
  draining: ['active', 'retired'],
  retired: [],
};

export function isNodeStatus(v: string): v is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(v);
}
export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  return from !== to && NODE_TRANSITIONS[from].includes(to);
}
/** Legal next states from `from` — drives the status <select> so only valid moves are offered. */
export function statusTargets(from: NodeStatus): NodeStatus[] {
  return [...NODE_TRANSITIONS[from]];
}
/** Only an `active` node accepts new tenant placements (mirror acceptsPlacement). */
export function acceptsPlacement(status: NodeStatus): boolean {
  return status === 'active';
}
export function nodeStatusKey(status: string): string {
  return isNodeStatus(status) ? `cells.node.${status}` : 'cells.node.unknown';
}
/** Token class for a node status chip. */
export function nodeStatusTone(status: string): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'active') return 'ok';
  if (status === 'readonly' || status === 'draining') return 'warn';
  if (status === 'retired') return 'danger';
  return 'muted';
}

// ---- validators (mirror cells-ops.dto.ts + routing.ts) ----------------------------------------------------------
export const CELL_CODE_RE = /^[a-z][a-z0-9-]{1,39}$/;   // immutable structural key
export const COUNTRY_RE = /^[A-Z]{2}$/;                  // ISO-3166 alpha-2, upper
const DIGITS_RE = /^\d+$/;

/** fieldKey is a SHORT token (e.g. 'code', 'reason', 'illegal'); the UI renders it as `cells.err.${fieldKey}`,
 *  the same namespace the Server Actions use for admin-api error mapping. */
export class CellInputError extends Error {
  constructor(public readonly fieldKey: string) {
    super(fieldKey);
    this.name = 'CellInputError';
  }
}

export function validCode(raw: string): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (!CELL_CODE_RE.test(v)) throw new CellInputError('code');
  return v;
}
export function validCountry(raw: string): string {
  const v = (raw ?? '').trim().toUpperCase();
  if (!COUNTRY_RE.test(v)) throw new CellInputError('country');
  return v;
}
export function validName(raw: string): string {
  const v = (raw ?? '').trim();
  if (v.length < 1 || v.length > 150) throw new CellInputError('name');
  return v;
}
/** Notes: optional, ≤ 2000, returns null when blank. */
export function validNotes(raw: string): string | null {
  const v = (raw ?? '').trim();
  if (v.length === 0) return null;
  if (v.length > 2000) throw new CellInputError('notes');
  return v;
}
export function validReason(raw: string): string {
  const v = (raw ?? '').trim();
  if (v.length < 3 || v.length > 500) throw new CellInputError('reason');
  return v;
}

// float-free bounded-int parse: empty → null (for optional fields), else digit string within [min,max].
function intInRange(raw: string, min: number, max: number, key: string): number {
  const v = (raw ?? '').trim();
  if (!DIGITS_RE.test(v)) throw new CellInputError(key);
  const n = +v; // safe: v is all digits
  if (n < min || n > max) throw new CellInputError(key);
  return n;
}

/** Capacity is nullable 0..100_000_000 — blank means "unbounded" (null). */
export function parseCapacity(raw: string): number | null {
  const v = (raw ?? '').trim();
  if (v.length === 0) return null;
  return intInRange(v, 0, 100_000_000, 'cells.err.capacity');
}
export function parseShardIndex(raw: string): number {
  return intInRange(raw, 0, 100_000, 'cells.err.shardIndex');
}
/** Weight 0..10_000 — blank defaults to 100 (mirror dto default). */
export function parseWeight(raw: string): number {
  const v = (raw ?? '').trim();
  if (v.length === 0) return 100;
  return intInRange(v, 0, 10_000, 'cells.err.weight');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validUuid(raw: string, key: string): string {
  const v = (raw ?? '').trim();
  if (!UUID_RE.test(v)) throw new CellInputError(key);
  return v;
}
/** Checkbox/booleans come through forms as 'true'/'on'/'1' vs everything else. */
export function parseBool(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === 'on' || v === '1' || v === 'yes';
}

// ---- builders (each returns the exact JSON body admin-api expects, incl. audit `reason`) -------------------------
export interface CreateCellBody {
  code: string; displayName: string; countryCode: string; isDefault: boolean;
  residencyLocked: boolean; capacityTenants: number | null; notes: string | null; reason: string;
}
export function buildCreateCell(f: {
  code: string; displayName: string; countryCode: string; isDefault?: string;
  residencyLocked?: string; capacityTenants: string; notes: string; reason: string;
}): CreateCellBody {
  return {
    code: validCode(f.code),
    displayName: validName(f.displayName),
    countryCode: validCountry(f.countryCode),
    isDefault: parseBool(f.isDefault),
    // residency-lock defaults ON for a new cell (DPDP-safe default); only an explicit opt-out unlocks it.
    residencyLocked: f.residencyLocked === undefined ? true : parseBool(f.residencyLocked),
    capacityTenants: parseCapacity(f.capacityTenants),
    notes: validNotes(f.notes),
    reason: validReason(f.reason),
  };
}

export interface UpdateCellBody {
  displayName?: string; capacityTenants?: number | null; residencyLocked?: boolean; notes?: string | null; reason: string;
}
/** Meta edit; at least one field must change (mirror updateMeta no-op guard). `code`/`country` are immutable. */
export function buildUpdateCell(f: {
  displayName?: string; capacityTenants?: string; residencyLocked?: string; notes?: string; reason: string;
}): UpdateCellBody {
  const body: UpdateCellBody = { reason: validReason(f.reason) };
  let touched = false;
  if (f.displayName !== undefined && f.displayName.trim() !== '') { body.displayName = validName(f.displayName); touched = true; }
  if (f.capacityTenants !== undefined) { body.capacityTenants = parseCapacity(f.capacityTenants); touched = true; }
  if (f.residencyLocked !== undefined) { body.residencyLocked = parseBool(f.residencyLocked); touched = true; }
  if (f.notes !== undefined) { body.notes = validNotes(f.notes); touched = true; }
  if (!touched) throw new CellInputError('noChange');
  return body;
}

export interface SetStatusBody { status: NodeStatus; reason: string; }
export function buildSetStatus(from: NodeStatus, raw: string, reason: string): SetStatusBody {
  const v = (raw ?? '').trim();
  if (!isNodeStatus(v)) throw new CellInputError('status');
  if (!canTransition(from, v)) throw new CellInputError('illegal');
  return { status: v, reason: validReason(reason) };
}

export interface SetDefaultBody { isDefault: boolean; reason: string; }
export function buildSetDefault(isDefault: boolean, reason: string): SetDefaultBody {
  return { isDefault, reason: validReason(reason) };
}

export interface SetResidencyLockBody { residencyLocked: boolean; reason: string; }
export function buildSetResidencyLock(residencyLocked: boolean, reason: string): SetResidencyLockBody {
  return { residencyLocked, reason: validReason(reason) };
}

export interface CreateShardBody { cellId: string; shardIndex: number; weight: number; notes: string | null; reason: string; }
export function buildCreateShard(f: {
  cellId: string; shardIndex: string; weight: string; notes: string; reason: string;
}): CreateShardBody {
  return {
    cellId: validUuid(f.cellId, 'cells.err.cellId'),
    shardIndex: parseShardIndex(f.shardIndex),
    weight: parseWeight(f.weight),
    notes: validNotes(f.notes),
    reason: validReason(f.reason),
  };
}

export interface UpdateShardBody { weight?: number; notes?: string | null; reason: string; }
/** Shard meta edit; ≥1 change. `cell_id`/`shard_index` immutable. dsn_secret_ref is intentionally NOT settable from
 *  this console (a secret must never transit the browser); leave it to a secrets workflow. */
export function buildUpdateShard(f: { weight?: string; notes?: string; reason: string }): UpdateShardBody {
  const body: UpdateShardBody = { reason: validReason(f.reason) };
  let touched = false;
  if (f.weight !== undefined && f.weight.trim() !== '') { body.weight = parseWeight(f.weight); touched = true; }
  if (f.notes !== undefined) { body.notes = validNotes(f.notes); touched = true; }
  if (!touched) throw new CellInputError('noChange');
  return body;
}

export interface PlaceBody { tenantId: string; cellId: string; shardId: string; pinned: boolean; reason: string; }
export function buildPlace(f: {
  tenantId: string; cellId: string; shardId: string; pinned?: string; reason: string;
}): PlaceBody {
  return {
    tenantId: validUuid(f.tenantId, 'cells.err.tenantId'),
    cellId: validUuid(f.cellId, 'cells.err.cellId'),
    shardId: validUuid(f.shardId, 'cells.err.shardId'),
    pinned: parseBool(f.pinned),
    reason: validReason(f.reason),
  };
}

export interface MoveBody { cellId: string; shardId: string; pinned?: boolean; reason: string; }
export function buildMove(f: { cellId: string; shardId: string; pinned?: string; reason: string }): MoveBody {
  const body: MoveBody = {
    cellId: validUuid(f.cellId, 'cells.err.cellId'),
    shardId: validUuid(f.shardId, 'cells.err.shardId'),
    reason: validReason(f.reason),
  };
  if (f.pinned !== undefined) body.pinned = parseBool(f.pinned);
  return body;
}

export interface RemoveBody { reason: string; }
export function buildRemove(reason: string): RemoveBody {
  return { reason: validReason(reason) };
}

// ---- read-model types (mirror cell/shard entity toJSON + repository rows) ----------------------------------------
export interface CellRow {
  id: string; code: string; displayName: string; countryCode: string; status: string;
  isDefault: boolean; residencyLocked: boolean; capacityTenants: number | null; placedCount: number;
  notes: string | null; createdAt: string | null;
}
export interface ShardRow {
  id: string; cellId: string; shardIndex: number; status: string; weight: number;
  placedCount: number; hasDsn: boolean; notes: string | null; createdAt: string | null;
}
export interface PlacementRow { tenantId: string; cellId: string; shardId: string; pinned: boolean; createdAt: string | null; }
export interface ResidencyRow {
  countryCode: string; cells: number; activeCells: number; allResidencyLocked: boolean; placedTenants: number;
}
export interface CellChangeRow {
  id: string; entityType: string; entityId: string; action: string;
  oldValue: unknown; newValue: unknown; reason: string | null; actorUserId: string | null; createdAt: string | null;
}

// ---- residency warning semantics --------------------------------------------------------------------------------
/** A residency-locked cell pins tenants to a DPDP residency boundary; unlocking or moving across it needs a warning. */
export function residencyWarnKey(action: 'lock' | 'unlock' | 'move'): string {
  if (action === 'unlock') return 'cells.warn.unlock';
  if (action === 'move') return 'cells.warn.move';
  return 'cells.warn.lock';
}
/** A residency report row is "at risk" if a country has tenants but not every serving cell is residency-locked. */
export function residencyAtRisk(row: ResidencyRow): boolean {
  return row.placedTenants > 0 && !row.allResidencyLocked;
}
