// apps/web-admin/src/features/announcements/announcement.ts · PURE, framework-free helpers + types for the god-mode
// platform-announcements console. No fetch, no React → unit-tested. MIRRORS admin-api announcements: the lifecycle
// state machine (announcement.state — draft → scheduled|published → expired → archived), the plain-text + audience
// content rules (content.ts), and the schedule-window bounds. Announcement text is PLAIN TEXT (no HTML) — the
// angle-bracket guard is mirrored here so a bad notice is rejected before it ever reaches the write. No money.

// Mirrors admin-api announcement.state.ts.
export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'expired', 'archived'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<AnnouncementStatus, readonly AnnouncementStatus[]>> = {
  draft: ['scheduled', 'published', 'archived'],
  scheduled: ['published', 'archived'],
  published: ['expired', 'archived'],
  expired: ['archived'],
  archived: [],
};
export function canTransition(from: AnnouncementStatus, to: AnnouncementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function announcementStatusKey(s: string | null | undefined): AnnouncementStatus {
  return (ANNOUNCEMENT_STATUSES as readonly string[]).includes(s ?? '') ? (s as AnnouncementStatus) : 'draft';
}
export function isTerminal(s: AnnouncementStatus): boolean { return s === 'archived'; }
/** Content/schedule are editable only while still being prepared (mirrors isEditable). */
export function canEdit(s: AnnouncementStatus): boolean { return s === 'draft' || s === 'scheduled'; }
export function canSchedule(s: AnnouncementStatus): boolean { return canTransition(s, 'scheduled'); }   // draft only
export function canPublish(s: AnnouncementStatus): boolean { return canTransition(s, 'published'); }    // draft|scheduled
export function canExpire(s: AnnouncementStatus): boolean { return canTransition(s, 'expired'); }       // published
export function canArchive(s: AnnouncementStatus): boolean { return canTransition(s, 'archived'); }     // any non-terminal

// Mirrors admin-api content.ts.
export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const PLACEMENTS = ['banner', 'modal', 'toast'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const MAX_PLANS = 200;
export const MAX_COUNTRIES = 300;

const PLAN_RE = /^[a-z0-9_]{1,40}$/;
const CC_RE = /^[A-Z]{2}$/;
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function isIsoDateTime(v: string | null | undefined): boolean { return ISO_DT_RE.test((v ?? '').trim()); }
export function validReason(r: string | null | undefined): boolean {
  const v = (r ?? '').trim();
  return v.length >= 3 && v.length <= 1000;
}
/** Plain text only — reject angle brackets (no HTML; mirrors assertPlainText's stored-XSS guard). */
export function isPlainText(v: string): boolean { return !/[<>]/.test(v); }

/** Split a comma/whitespace-separated input into a trimmed, de-duped list (drops empties). */
export function parseCsvList(raw: string | undefined): string[] {
  return Array.from(new Set((raw ?? '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)));
}

export type ContentResult =
  | { ok: true; value: { title: string; body: string; severity: Severity; placement: Placement; plans: string[]; countries: string[]; reason: string } }
  | { ok: false; error: 'title' | 'body' | 'severity' | 'placement' | 'plans' | 'countries' | 'reason' };

/** Shared builder for create + update (same field shape). Country codes are upper-cased before validation. */
export function buildContent(raw: { title?: string; body?: string; severity?: string; placement?: string; plans?: string; countries?: string; reason?: string }): ContentResult {
  const title = (raw.title ?? '').trim();
  if (title.length < 1 || title.length > 200 || !isPlainText(title)) return { ok: false, error: 'title' };
  const body = (raw.body ?? '').trim();
  if (body.length < 1 || body.length > 4000 || !isPlainText(body)) return { ok: false, error: 'body' };
  const severity = (raw.severity ?? 'info').trim();
  if (!(SEVERITIES as readonly string[]).includes(severity)) return { ok: false, error: 'severity' };
  const placement = (raw.placement ?? 'banner').trim();
  if (!(PLACEMENTS as readonly string[]).includes(placement)) return { ok: false, error: 'placement' };
  const plans = parseCsvList(raw.plans);
  if (plans.length > MAX_PLANS || !plans.every((p) => PLAN_RE.test(p))) return { ok: false, error: 'plans' };
  const countries = parseCsvList(raw.countries).map((c) => c.toUpperCase());
  if (countries.length > MAX_COUNTRIES || !countries.every((c) => CC_RE.test(c))) return { ok: false, error: 'countries' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { title, body, severity: severity as Severity, placement: placement as Placement, plans, countries, reason: (raw.reason ?? '').trim() } };
}

export type ScheduleResult =
  | { ok: true; value: { startsAt: string; endsAt: string; reason: string } }
  | { ok: false; error: 'startsAt' | 'endsAt' | 'window' | 'reason' };

export function buildSchedule(raw: { startsAt?: string; endsAt?: string; reason?: string }): ScheduleResult {
  const startsAt = (raw.startsAt ?? '').trim();
  if (!isIsoDateTime(startsAt)) return { ok: false, error: 'startsAt' };
  const endsAt = (raw.endsAt ?? '').trim();
  if (!isIsoDateTime(endsAt)) return { ok: false, error: 'endsAt' };
  if (startsAt >= endsAt) return { ok: false, error: 'window' };   // ISO-8601 UTC strings sort chronologically
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { startsAt, endsAt, reason: (raw.reason ?? '').trim() } };
}

export type PublishResult =
  | { ok: true; value: { endsAt?: string; reason: string } }
  | { ok: false; error: 'endsAt' | 'reason' };

export function buildPublish(raw: { endsAt?: string; reason?: string }): PublishResult {
  const endsAt = (raw.endsAt ?? '').trim();
  if (endsAt && !isIsoDateTime(endsAt)) return { ok: false, error: 'endsAt' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { ...(endsAt ? { endsAt } : {}), reason: (raw.reason ?? '').trim() } };
}

export type ReasonResult = { ok: true; value: { reason: string } } | { ok: false; error: 'reason' };
export function buildReason(raw: { reason?: string }): ReasonResult {
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { reason: (raw.reason ?? '').trim() } };
}

// ---- read-model shapes (mirror admin-api announcements read models; type-only, no runtime) ----
export interface Audience { plans?: string[]; countries?: string[] }
export interface AnnouncementRow {
  id: string; title: string; body: string; severity: Severity | string; placement: Placement | string;
  status: AnnouncementStatus; audience: Audience; startsAt: string | null; endsAt: string | null;
  publishedAt: string | null; createdAt: string | null;
}
export interface ChangeRow { id: string; announcementId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string; createdAt: string | null }
