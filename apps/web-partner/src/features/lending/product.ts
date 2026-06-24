// apps/web-partner/src/features/lending/product.ts · PURE helpers for the lender's loan-product catalogue + the
// platform lender registry. Mirrors apps/api fintech loan-product / financial-partner read-models EXACTLY. No I/O,
// no React. Money is rendered from bigint MINOR-UNIT strings by the caller (formatMoneyMinor); the interest APR is
// an INTEGER basis-point value (Law 2 — never a float), formatted to a percent with integer math only.

// ---- partner kinds (mirror fintech.events PARTNER_KINDS) ---------------------------------------------------------
export const PARTNER_KINDS = ['bank', 'nbfc', 'mfi', 'insurer', 'amc', 'gold_loan'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export function isPartnerKind(v: string | undefined): v is PartnerKind {
  return !!v && (PARTNER_KINDS as readonly string[]).includes(v);
}
export function partnerKindKey(kind: string): string {
  return isPartnerKind(kind) ? `lender.kind.${kind}` : 'lender.kind.unknown';
}

// ---- formatting (float-free) -------------------------------------------------------------------------------------
const BPS_RE = /^\d+$/;
/** Interest APR is stored as integer basis points (100 bps = 1%). Render as a percent with 2 decimals using integer
 *  math only — never a float. e.g. 1250 → "12.50%". Negative/garbage → '—' handled by the caller (returns null). */
export function formatAprBps(bps: number | null | undefined): string | null {
  if (bps === null || bps === undefined) return null;
  if (!Number.isInteger(bps) || bps < 0) return null;
  const whole = Math.floor(bps / 100);
  const frac = String(bps % 100).padStart(2, '0');
  return `${whole}.${frac}%`;
}
/** Format the optional tenure window (whole months). */
export function formatTenureMonths(min: number | null, max: number | null): { kind: 'range' | 'min' | 'max' | 'none'; min: number | null; max: number | null } {
  if (min !== null && max !== null) return { kind: 'range', min, max };
  if (min !== null) return { kind: 'min', min, max: null };
  if (max !== null) return { kind: 'max', min: null, max };
  return { kind: 'none', min: null, max: null };
}

/** Read a digit-only bps string from a (hypothetical) form/query without float coercion. */
export function parseBps(raw: string | undefined): number | null {
  const v = (raw ?? '').trim();
  if (!BPS_RE.test(v)) return null;
  return +v; // safe: digits only
}

/** activeOnly query toggle — defaults to true (the API's default), only an explicit "false"/"0" shows inactive. */
export function parseActiveOnly(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

// ---- read-model types (mirror loan-product + financial-partner toJSON) -------------------------------------------
export interface ProductRow {
  id: string; partnerId: string; productKindId: string; name: string; currencyCode: string;
  minAmountMinor: string; maxAmountMinor: string; interestAprBps: number;
  tenureMonthsMin: number | null; tenureMonthsMax: number | null;
  collateralKind: string | null; repaymentStyle: string; isActive: boolean;
}
export interface PartnerRow {
  id: string; code: string; name: string; partnerKind: string; regulatorRef: string | null; isActive: boolean;
}
