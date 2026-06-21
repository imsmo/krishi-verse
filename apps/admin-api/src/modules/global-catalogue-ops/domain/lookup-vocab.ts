// apps/admin-api/src/modules/global-catalogue-ops/domain/lookup-vocab.ts · pure guards for the controlled-
// vocabulary registry (lookup_types + PLATFORM lookup_values). Codes are STABLE keys other tables reference
// (e.g. certificates.cert_type_id, doc_type, cancel_reason) — they are charset-bounded, lowercase, and IMMUTABLE
// after create (rename touches default_name only). `meta` is bounded so a malicious value can't bloat the row.
import { InvalidCatalogueInputError } from './catalogue.errors';
import { assertPlainText } from './text';

export const MAX_TYPE_CODE = 60;     // lookup_types.code varchar(60)
export const MAX_VALUE_CODE = 80;    // lookup_values.code varchar(80)
export const MAX_TYPE_NAME = 100;    // lookup_types.default_name varchar(100)
export const MAX_VALUE_NAME = 150;   // lookup_values.default_name varchar(150)
export const MAX_META_KEYS = 50;
export const MAX_META_BYTES = 4000;
export const MAX_SORT_ORDER = 32767; // smallint
// anchored, linear-time, no backtracking groups (ReDoS-safe). Lowercase identifiers.
const TYPE_CODE_RE = /^[a-z][a-z0-9_]{1,59}$/;       // 'cancel_reason','dispute_reason','doc_type','cert_type'
const VALUE_CODE_RE = /^[a-z0-9][a-z0-9_.-]{0,79}$/; // 'npop','pgs_india','usda_organic','gi_tag'

export function assertTypeCode(code: string): string {
  const v = code.trim();
  if (!TYPE_CODE_RE.test(v)) throw new InvalidCatalogueInputError(`type code must match ^[a-z][a-z0-9_]{1,59}$ (got '${code}')`);
  return v;
}
export function assertValueCode(code: string): string {
  const v = code.trim();
  if (!VALUE_CODE_RE.test(v)) throw new InvalidCatalogueInputError(`value code must match ^[a-z0-9][a-z0-9_.-]{0,79}$ (got '${code}')`);
  return v;
}
export function assertTypeName(name: string): string { return assertPlainText(name, 'default_name', MAX_TYPE_NAME); }
export function assertValueName(name: string): string { return assertPlainText(name, 'default_name', MAX_VALUE_NAME); }

export function assertSortOrder(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SORT_ORDER) throw new InvalidCatalogueInputError(`sort_order must be an integer in 0..${MAX_SORT_ORDER}`);
  return n;
}

/** Bounded JSON meta: an object of primitive (or array-of-primitive) values, capped key-count + serialized size. */
export function assertMeta(meta: Record<string, unknown>): Record<string, unknown> {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) throw new InvalidCatalogueInputError('meta must be a JSON object');
  const keys = Object.keys(meta);
  if (keys.length > MAX_META_KEYS) throw new InvalidCatalogueInputError(`meta exceeds ${MAX_META_KEYS} keys`);
  for (const k of keys) {
    const val = meta[k];
    const ok = val === null || ['string', 'number', 'boolean'].includes(typeof val) ||
      (Array.isArray(val) && val.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x)));
    if (!ok) throw new InvalidCatalogueInputError(`meta.${k} must be a primitive or array of primitives`);
  }
  if (Buffer.byteLength(JSON.stringify(meta), 'utf8') > MAX_META_BYTES) throw new InvalidCatalogueInputError(`meta exceeds ${MAX_META_BYTES} bytes`);
  return meta;
}
