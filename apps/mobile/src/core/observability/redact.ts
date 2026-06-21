// apps/mobile/src/core/observability/redact.ts · the PII/secret SCRUBBER (guide §4/§6 + DoD "no PII in any
// payload"). EVERYTHING that leaves the device for the crash service or analytics passes through redactPII first:
// crash beforeSend, breadcrumbs, analytics props, structured logs. It deep-walks values, dropping/masking by
// (a) a key-name denylist (token/authorization/otp/password/aadhaar/pan/account/vaultRef/email/phone/...) and
// (b) value patterns (bearer/JWT, Indian phone, Aadhaar, PAN, long digit runs that look like account/card numbers,
// email). PURE — no React/native — so it is exhaustively unit-tested. Bounded depth + breadth (never hang on a
// cyclic / huge object). The server is the authority; this just ensures the client never ships PII upstream.

export const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;
const MAX_KEYS = 200;
const MAX_STR = 2048;

/** Key names whose VALUE must always be dropped, regardless of content. Lowercased substring match. */
const KEY_DENYLIST = [
  'token', 'authorization', 'auth', 'password', 'passcode', 'pin', 'otp', 'secret', 'apikey', 'api_key',
  'aadhaar', 'aadhar', 'pan', 'account', 'accountnumber', 'acct', 'ifsc', 'upi', 'vaultref', 'cvv', 'card',
  'email', 'phone', 'mobile', 'msisdn', 'dob', 'cookie', 'session', 'refresh',
];
function isDeniedKey(key: string): boolean {
  const k = key.toLowerCase();
  return KEY_DENYLIST.some((d) => k.includes(d));
}

// Value patterns (plain, bounded — no catastrophic backtracking).
const RE_BEARER = /Bearer\s+[A-Za-z0-9._-]+/gi;
const RE_JWT = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const RE_EMAIL = /\b[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}\b/g;
const RE_PHONE = /(\+?\d{1,3}[ -]?)?\b\d{10}\b/g;        // 10-digit mobile (optionally +CC)
const RE_AADHAAR = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;          // 12-digit Aadhaar
const RE_PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;                // PAN
const RE_LONGNUM = /\b\d{12,19}\b/g;                     // account/card-like long digit runs

/** Mask sensitive substrings inside a free-text string (e.g. a log message or error text). */
export function scrubString(input: string): string {
  let s = (input ?? '').slice(0, MAX_STR);
  s = s.replace(RE_BEARER, REDACTED).replace(RE_JWT, REDACTED).replace(RE_AADHAAR, REDACTED)
       .replace(RE_PAN, REDACTED).replace(RE_LONGNUM, REDACTED).replace(RE_EMAIL, REDACTED).replace(RE_PHONE, REDACTED);
  return s;
}

/** Deep-scrub any value for safe transport. Objects → keys on the denylist are dropped; strings → pattern-masked;
 * arrays/objects recursed (bounded). Cyclic refs and over-deep/over-wide structures collapse to a marker. */
export function redactPII<T>(value: T, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[CIRCULAR]';
    seen.add(value as object);
    if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((v) => redactPII(v, depth + 1, seen));
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (++n > MAX_KEYS) break;
      out[k] = isDeniedKey(k) ? REDACTED : redactPII(v, depth + 1, seen);
    }
    return out;
  }
  return REDACTED; // functions/symbols/unknown — never ship
}
