// apps/admin-api/src/modules/schemes-registry-ops/domain/scheme-rules.ts · pure guards for the scheme master.
// Names/source are PLAIN TEXT / safe URLs (no HTML, §4). `code` is the STABLE, IMMUTABLE catalogue key the apps/
// api read path + scheme_applications.scheme_version snapshot against — charset-bounded + lowercase. The
// machine-evaluable blobs (benefit_summary / eligibility_rules) and the id arrays are bounded so a malicious edit
// can't bloat the row. processing_fee_minor is bigint minor units (Law 2) — digit-string → bigint, never float.
import { InvalidSchemeInputError } from './schemes-registry.errors';

export const MAX_CODE = 60;            // schemes.code varchar(60)
export const MAX_SCHEME_NAME = 250;    // schemes.default_name varchar(250)
export const MAX_AUTHORITY_NAME = 200; // scheme_authorities.default_name varchar(200)
export const MAX_URL = 400;            // schemes.source_url varchar(400)
export const MAX_JSON_BYTES = 8000;    // benefit_summary / eligibility_rules each
export const MAX_DOC_TYPES = 100;
export const MAX_REGIONS = 2000;
export const MAX_FEE_MINOR = 10n ** 12n;   // ₹10,00,00,000 cap — a registry processing fee is never larger
export const AUTHORITY_LEVELS = ['central', 'state', 'district', 'body'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const CODE_RE = /^[a-z][a-z0-9_]{1,59}$/;     // 'pm_kisan','pmfby','kcc' — anchored, ReDoS-safe
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MMDD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;   // 'MM-DD'
const SEASON_RE = /^[a-z_]{1,20}$/;

/** Plain-text only: trim, reject empty / over-length / angle brackets / control chars. */
export function assertPlainText(value: string, field: string, max: number): string {
  const v = value.trim();
  if (!v) throw new InvalidSchemeInputError(`${field} is required`);
  if (v.length > max) throw new InvalidSchemeInputError(`${field} exceeds ${max} chars`);
  if (/[<>]/.test(v)) throw new InvalidSchemeInputError(`${field} must be plain text (no HTML)`);
  if (CONTROL_RE.test(v)) throw new InvalidSchemeInputError(`${field} contains control characters`);
  return v;
}
export function assertSchemeName(v: string): string { return assertPlainText(v, 'default_name', MAX_SCHEME_NAME); }
export function assertAuthorityName(v: string): string { return assertPlainText(v, 'default_name', MAX_AUTHORITY_NAME); }

export function assertCode(code: string): string {
  const v = code.trim();
  if (!CODE_RE.test(v)) throw new InvalidSchemeInputError(`scheme code must match ^[a-z][a-z0-9_]{1,59}$ (got '${code}')`);
  return v;
}
export function assertLevel(level: string): AuthorityLevel {
  if (!(AUTHORITY_LEVELS as readonly string[]).includes(level)) throw new InvalidSchemeInputError(`level must be one of ${AUTHORITY_LEVELS.join('|')}`);
  return level as AuthorityLevel;
}
export function assertUuidOrNull(v: string | null, field: string): string | null {
  if (v === null) return null;
  if (!UUID_RE.test(v)) throw new InvalidSchemeInputError(`${field} must be a uuid`);
  return v;
}

/** A required, non-empty, bounded JSON object (benefit_summary / eligibility_rules are NOT NULL in schema). */
export function assertJsonObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidSchemeInputError(`${field} must be a JSON object`);
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length === 0) throw new InvalidSchemeInputError(`${field} must not be empty`);
  if (Buffer.byteLength(JSON.stringify(obj), 'utf8') > MAX_JSON_BYTES) throw new InvalidSchemeInputError(`${field} exceeds ${MAX_JSON_BYTES} bytes`);
  return obj;
}

export function assertUuidArray(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value)) throw new InvalidSchemeInputError(`${field} must be an array`);
  if (value.length > max) throw new InvalidSchemeInputError(`${field} exceeds ${max} entries`);
  for (const v of value) if (typeof v !== 'string' || !UUID_RE.test(v)) throw new InvalidSchemeInputError(`${field} must be uuids`);
  return value as string[];
}

/** application_window: {opens:'MM-DD', closes:'MM-DD', season?}. opens>closes ⇒ a year-wrapping window (allowed). */
export function assertWindow(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new InvalidSchemeInputError('application_window must be an object');
  const w = value as Record<string, unknown>;
  const opens = w.opens; const closes = w.closes; const season = w.season;
  if (typeof opens !== 'string' || !MMDD_RE.test(opens)) throw new InvalidSchemeInputError("application_window.opens must be 'MM-DD'");
  if (typeof closes !== 'string' || !MMDD_RE.test(closes)) throw new InvalidSchemeInputError("application_window.closes must be 'MM-DD'");
  if (season !== undefined && (typeof season !== 'string' || !SEASON_RE.test(season))) throw new InvalidSchemeInputError('application_window.season must match ^[a-z_]{1,20}$');
  const out: Record<string, unknown> = { opens, closes };
  if (season !== undefined) out.season = season;
  return out;
}

/** processing_fee_minor: a non-negative bigint (minor units), bounded. Accepts a digit string (never a float). */
export function assertFeeMinor(value: string): bigint {
  if (!/^\d{1,15}$/.test(value)) throw new InvalidSchemeInputError('processing_fee_minor must be a non-negative integer string (minor units)');
  const n = BigInt(value);
  if (n > MAX_FEE_MINOR) throw new InvalidSchemeInputError(`processing_fee_minor exceeds the ${MAX_FEE_MINOR} cap`);
  return n;
}

export function assertSourceUrl(value: string | null): string | null {
  if (value === null) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length > MAX_URL) throw new InvalidSchemeInputError(`source_url exceeds ${MAX_URL} chars`);
  let u: URL;
  try { u = new URL(v); } catch { throw new InvalidSchemeInputError('source_url must be a valid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new InvalidSchemeInputError('source_url must be http(s)');
  return v;
}
