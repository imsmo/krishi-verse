// apps/web-tenant/src/features/ambassadors/admin.ts · PURE validators + presenters for the ambassadors admin
// console. No framework, no I/O → unit-tested. The SERVER stays authoritative: it computes + moves all commission
// through the wallet ledger (Law 2/11), enforces RBAC (`ambassador.manage`), and runs the referral/profile state
// machines. These helpers only pre-validate the form and total UNPAID earnings for a payout PREVIEW. Money is
// bigint minor-unit STRINGS — never a float (Law 2). Regexes are anchored, fixed char-classes (ReDoS-safe).

export const TARGET_METRICS = ['onboardings', 'sales_facilitated', 'earnings_minor', 'visits'] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

const UUID = /^[0-9a-fA-F-]{36}$/;
const MINOR = /^\d{1,15}$/;           // non-negative integer minor units
const COUNT = /^\d{1,18}$/;           // non-negative integer (count or minor units)
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate the enroll form. Returns a field code on the first problem, else null. */
export function validateEnroll(input: { userId: string; monthlyStipendMinor?: string; clusterRegionIds?: string[] }): string | null {
  if (!UUID.test(input.userId)) return 'user';
  if (input.monthlyStipendMinor != null && input.monthlyStipendMinor !== '' && !MINOR.test(input.monthlyStipendMinor)) return 'stipend';
  if (input.clusterRegionIds && (input.clusterRegionIds.length > 3 || input.clusterRegionIds.some((r) => !UUID.test(r)))) return 'clusters';
  return null;
}

/** Validate the set-target form. */
export function validateTarget(input: { ambassadorId: string; metric: string; periodStart: string; periodEnd: string; targetValue: string }): string | null {
  if (!UUID.test(input.ambassadorId)) return 'ambassador';
  if (!TARGET_METRICS.includes(input.metric as TargetMetric)) return 'metric';
  if (!DATE.test(input.periodStart) || !DATE.test(input.periodEnd)) return 'dates';
  if (input.periodEnd < input.periodStart) return 'dateOrder';
  if (!COUNT.test(input.targetValue)) return 'value';
  return null;
}

/** Sum UNPAID earnings (payoutId == null) — a payout PREVIEW only; the server computes the authoritative total. */
export function previewUnpaidMinor(earnings: Array<{ amountMinor: string; payoutId: string | null }>): string {
  let total = 0n;
  for (const e of earnings) if (e.payoutId == null && MINOR.test(e.amountMinor)) total += BigInt(e.amountMinor);
  return total.toString();
}

/** Whether a payout button should be offered (active ambassador with at least one unpaid earning). */
export function canPayout(profile: { isActive: boolean }, unpaidMinor: string): boolean {
  return profile.isActive && /^\d+$/.test(unpaidMinor) && BigInt(unpaidMinor) > 0n;
}

/** Whether a referral can be activated by the admin (only an unactivated, signed-up referral). */
export function canActivateReferral(status: string): boolean {
  return status === 'signed_up' || status === 'invited';
}
