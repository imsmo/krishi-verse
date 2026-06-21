// apps/admin-api/src/modules/cells-ops/domain/routing.ts · pure routing/validation guards for the cell+shard
// directory. These are the safety-critical invariants — a misroute sends a tenant's data to the wrong physical
// stack / wrong country — so they ALL fail CLOSED (throw). Framework-free, exhaustively unit-tested.
import { InvalidCellsInputError } from './cells-ops.errors';

export const MAX_CODE = 40;          // cells.code varchar(40)
export const MAX_NAME = 150;         // display_name varchar(150)
export const MAX_NOTES = 2000;
export const MAX_CAPACITY = 100_000_000;   // soft cap upper bound (sanity)
export const MAX_SHARD_INDEX = 100_000;
export const MAX_WEIGHT = 10_000;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const CODE_RE = /^[a-z][a-z0-9-]{1,39}$/;    // 'in-west-1' — anchored, ReDoS-safe, ltree/url-safe
const CC_RE = /^[A-Z]{2}$/;                  // ISO-3166 alpha-2 (countries.code is upper-case)

export function assertCellCode(code: string): string {
  const v = code.trim();
  if (!CODE_RE.test(v)) throw new InvalidCellsInputError(`cell code must match ^[a-z][a-z0-9-]{1,39}$ (got '${code}')`);
  return v;
}
export function assertName(value: string, field = 'display_name'): string {
  const v = value.trim();
  if (!v) throw new InvalidCellsInputError(`${field} is required`);
  if (v.length > MAX_NAME) throw new InvalidCellsInputError(`${field} exceeds ${MAX_NAME} chars`);
  if (/[<>]/.test(v)) throw new InvalidCellsInputError(`${field} must be plain text (no HTML)`);
  if (CONTROL_RE.test(v)) throw new InvalidCellsInputError(`${field} contains control characters`);
  return v;
}
export function assertCountry(code: string): string {
  const v = code.trim().toUpperCase();
  if (!CC_RE.test(v)) throw new InvalidCellsInputError('country_code must be ISO-3166 alpha-2');
  return v;
}
export function assertNotes(value: string | null): string | null {
  if (value === null) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length > MAX_NOTES) throw new InvalidCellsInputError(`notes exceed ${MAX_NOTES} chars`);
  if (CONTROL_RE.test(v.replace(/[\r\n\t]/g, ''))) throw new InvalidCellsInputError('notes contain control characters');
  return v;
}
export function assertCapacity(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > MAX_CAPACITY) throw new InvalidCellsInputError(`capacity_tenants must be an integer in 0..${MAX_CAPACITY} (or null = unbounded)`);
  return value;
}
export function assertShardIndex(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SHARD_INDEX) throw new InvalidCellsInputError(`shard_index must be an integer in 0..${MAX_SHARD_INDEX}`);
  return value;
}
export function assertWeight(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_WEIGHT) throw new InvalidCellsInputError(`weight must be an integer in 0..${MAX_WEIGHT}`);
  return value;
}

/** Capacity guard: a node with a cap may not exceed it (NULL cap = unbounded). Fails closed. */
export function hasRoom(placedCount: number, capacity: number | null): boolean {
  return capacity === null || placedCount < capacity;
}
/** Residency guard: a tenant's data may only move WITHIN the same country (DPDP / sovereignty). Fails closed. */
export function sameResidency(fromCountry: string, toCountry: string): boolean {
  return fromCountry === toCountry;
}
