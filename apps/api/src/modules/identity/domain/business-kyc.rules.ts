// modules/identity/domain/business-kyc.rules.ts
// Pure validation + masking for buyer business-KYC (P0-5). The RAW GSTIN/PAN is accepted ONCE at submission,
// validated for shape here, then MASKED before it ever touches the database or a log (DPDP data-minimisation, §4).
// No I/O — unit-testable in isolation.

/** The business types a buyer may declare (mirrors the CHECK in 0058_business_kyc_profiles.sql). */
export const BUSINESS_TYPES = [
  'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'fpo', 'cooperative', 'trader', 'huf', 'other',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export function isBusinessType(v: string): v is BusinessType { return (BUSINESS_TYPES as readonly string[]).includes(v); }

// GSTIN: 2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum char (15 total).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// PAN: 5 letters + 4 digits + 1 letter (10 total).
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isValidGstin(raw: string): boolean { return GSTIN_RE.test((raw ?? '').trim().toUpperCase()); }
export function isValidPan(raw: string): boolean { return PAN_RE.test((raw ?? '').trim().toUpperCase()); }

/** Mask a valid GSTIN to "27****...***3Z5" style — keep the 2-digit state code + last 4, mask the middle.
 *  Throws on a malformed value so we never store/echo an unvalidated GSTIN. */
export function maskGstin(raw: string): string {
  const g = (raw ?? '').trim().toUpperCase();
  if (!GSTIN_RE.test(g)) throw new Error('INVALID_GSTIN');
  return `${g.slice(0, 2)}******${g.slice(-4)}`; // 12 visible chars, middle 9 hidden
}
/** Mask a valid PAN to "AB****34F" — keep the first 2 + last 2, mask the middle. Throws on a malformed value. */
export function maskPan(raw: string): string {
  const p = (raw ?? '').trim().toUpperCase();
  if (!PAN_RE.test(p)) throw new Error('INVALID_PAN');
  return `${p.slice(0, 2)}****${p.slice(-2)}`;
}

/** GSTIN embeds the holder's PAN at chars 3–12 — when both are given they MUST agree (anti-mismatch guard). */
export function gstinPanConsistent(gstin: string, pan: string): boolean {
  const g = (gstin ?? '').trim().toUpperCase();
  const p = (pan ?? '').trim().toUpperCase();
  if (!GSTIN_RE.test(g) || !PAN_RE.test(p)) return false;
  return g.slice(2, 12) === p;
}
