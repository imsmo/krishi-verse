// apps/web-admin/src/features/reports/report.ts · PURE, framework-free helpers + types for the god-mode platform
// reports. No fetch, no React → unit-tested. Money totals stay bigint MINOR-UNIT STRINGS (rendered by the caller
// via formatMoneyMinor — never floated). The login-success ratio arrives as INTEGER BASIS POINTS and is formatted
// with integer math only (no float). buildReportQuery normalises the window/currency query (mirrors the admin-api
// zod schema: ISO from/to optional, ISO-4217 currency defaulting to INR).

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export interface ReportQuery { from?: string; to?: string; currency: string }

/** Normalise the report window/currency query. Bad/blank values are dropped (admin-api applies a default window);
 *  currency falls back to INR unless a valid ISO-4217 code is given. */
export function buildReportQuery(raw: { from?: string; to?: string; currency?: string }): ReportQuery {
  const out: ReportQuery = { currency: 'INR' };
  const cur = (raw.currency ?? '').trim().toUpperCase();
  if (CURRENCY_RE.test(cur)) out.currency = cur;
  const from = (raw.from ?? '').trim();
  if (ISO_DATETIME_RE.test(from) && !Number.isNaN(Date.parse(from))) out.from = new Date(from).toISOString();
  const to = (raw.to ?? '').trim();
  if (ISO_DATETIME_RE.test(to) && !Number.isNaN(Date.parse(to))) out.to = new Date(to).toISOString();
  return out;
}

/** Format integer basis points (0..10000) as a percentage string with 2 decimals — INTEGER MATH ONLY (no float).
 *  e.g. 9850 → "98.50%", 10000 → "100.00%", 0 → "0.00%". */
export function bpsToPercent(bps: number): string {
  const n = Number.isFinite(bps) ? Math.max(0, Math.trunc(bps)) : 0;
  const whole = Math.trunc(n / 100);
  const frac = n % 100;
  return `${whole}.${String(frac).padStart(2, '0')}%`;
}

// ---- read-model shapes (mirror admin-api platform-reports services; type-only, no runtime) ----
export interface ReportWindow { from: string; to: string }
export interface OverviewReport {
  window: ReportWindow; currency: string;
  revenue: { mrrMinor: string; arrMinor: string; activeSubscriptions: number };
  tenants: { activeTotal: number; total: number; byStatus: Record<string, number> };
  activity: { activeUsers: number; loginAttempts: number; loginSuccessBps: number };
  commerce: { gmvMinor: string; orders: number; platformFeeMinor: string; avgOrderValueMinor: string };
}
export interface GmvReport {
  window: ReportWindow; currency: string; tenantId: string | null;
  gmvMinor: string; platformFeeMinor: string; commissionMinor: string; orders: number; avgOrderValueMinor: string;
}
export interface TenantGrowthReport {
  window: ReportWindow; bucket: 'month'; totalNewTenants: number; buckets: { period: string; newTenants: number }[];
}
