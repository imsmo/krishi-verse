// apps/admin-api/src/modules/announcements/domain/content.ts · pure content/audience/schedule guards. Announcement
// text is PLAIN TEXT — `<`/`>` are rejected so a notice can never carry markup that a downstream renderer might
// execute (stored-XSS closed by construction, §4). Audience targeting ({plans,countries}) is validated + bounded;
// empty = everyone. Schedule windows must be forward + bounded.
import { InvalidAnnouncementError, InvalidScheduleError } from './announcements.errors';

export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const PLACEMENTS = ['banner', 'modal', 'toast'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const MAX_PLANS = 200;
export const MAX_COUNTRIES = 300;
export const MAX_WINDOW_DAYS = 365;        // an announcement can't be scheduled to run forever
const DAY_MS = 86_400_000;
const PLAN_RE = /^[a-z0-9_]{1,40}$/;
const CC_RE = /^[A-Z]{2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/** Plain-text only: reject angle brackets (no HTML) + control chars. Returns the trimmed text. */
export function assertPlainText(value: string, field: string, max: number): string {
  const v = value.trim();
  if (!v) throw new InvalidAnnouncementError(`${field} is required`);
  if (v.length > max) throw new InvalidAnnouncementError(`${field} exceeds ${max} chars`);
  if (/[<>]/.test(v)) throw new InvalidAnnouncementError(`${field} must be plain text (no HTML)`);
  if (CONTROL_RE.test(v)) throw new InvalidAnnouncementError(`${field} contains control characters`);
  return v;
}

export interface Audience { plans?: string[]; countries?: string[]; }
export function buildAudience(input: { plans?: string[]; countries?: string[] }): Audience {
  const plans = input.plans ?? [];
  const countries = input.countries ?? [];
  if (plans.length > MAX_PLANS) throw new InvalidAnnouncementError(`plans exceeds ${MAX_PLANS}`);
  if (countries.length > MAX_COUNTRIES) throw new InvalidAnnouncementError(`countries exceeds ${MAX_COUNTRIES}`);
  if (!plans.every((p) => PLAN_RE.test(p))) throw new InvalidAnnouncementError('plan codes must match ^[a-z0-9_]{1,40}$');
  if (!countries.every((c) => CC_RE.test(c))) throw new InvalidAnnouncementError('countries must be ISO-3166 alpha-2');
  return { plans, countries };
}

/** Validate a schedule window: forward, ends in the future, bounded duration. Returns {startsAt, endsAt}. */
export function assertWindow(startsAt: Date, endsAt: Date, now = new Date()): { startsAt: Date; endsAt: Date } {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new InvalidScheduleError('startsAt/endsAt must be valid timestamps');
  if (startsAt.getTime() >= endsAt.getTime()) throw new InvalidScheduleError('startsAt must be before endsAt');
  if (endsAt.getTime() <= now.getTime()) throw new InvalidScheduleError('endsAt must be in the future');
  if (endsAt.getTime() - startsAt.getTime() > MAX_WINDOW_DAYS * DAY_MS) throw new InvalidScheduleError(`window exceeds the ${MAX_WINDOW_DAYS}-day maximum`);
  return { startsAt, endsAt };
}
