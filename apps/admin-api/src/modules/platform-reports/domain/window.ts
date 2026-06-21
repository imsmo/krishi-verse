// apps/admin-api/src/modules/platform-reports/domain/window.ts · pure report-window validation. A window must be a
// valid, FORWARD, BOUNDED [from, to) range — this caps how much of the (partitioned) orders/login_events history a
// single dashboard query can scan (Law 5/§5 abuse bound). Defaults to the last 30 days when omitted.
import { InvalidWindowError } from './platform-reports.errors';

export const MAX_WINDOW_DAYS = 366;   // a single report may span at most ~1 year
const DAY_MS = 86_400_000;

export interface ReportWindow { from: Date; to: Date; }

/** Validate/normalise an optional ISO window. Throws InvalidWindowError on a bad/backwards/oversized range. */
export function resolveWindow(fromIso?: string, toIso?: string, now = new Date(), maxDays = MAX_WINDOW_DAYS): ReportWindow {
  const to = toIso ? new Date(toIso) : now;
  const from = fromIso ? new Date(fromIso) : new Date(to.getTime() - 30 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new InvalidWindowError('from/to must be valid ISO timestamps');
  if (from.getTime() >= to.getTime()) throw new InvalidWindowError('from must be strictly before to');
  if (to.getTime() - from.getTime() > maxDays * DAY_MS) throw new InvalidWindowError(`window exceeds the ${maxDays}-day maximum`);
  return { from, to };
}
