// apps/mobile/src/features/profile/profile.ts · PURE logic for the farmer profile/farm/bank/docs + help vertical
// (P-22). No React/native (SDK/ui types are `import type` → erased) → unit-tested. The SERVER owns profile writes,
// the support SLA clock + ticket state machine, KYC verification, and bank vaulting — these helpers only drive the
// UI: profile-patch + ticket + parcel form validation (bounded, ReDoS-safe), status/severity tone+labels, the SLA
// state read-out (server-set due-times vs now), and masked bank/area display.
import type { PillTone } from '@krishi-verse/ui-native';
import type { SupportTicket, TicketSeverity, TicketStatus, LandParcel, BankAccount } from '@krishi-verse/sdk-js';

// --- profile edit ---
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/; // bounded, no catastrophic backtracking
export function isValidEmail(email: string): boolean { return EMAIL_RE.test(email.trim()); }

export interface ProfileForm { fullName?: string; languageCode?: string; email?: string }
export interface ProfilePatch { fullName?: string; languageCode?: string; email?: string }
export interface ProfileDraft { ok: boolean; patch?: ProfilePatch; reason?: 'empty' | 'name' | 'email' }
/** Assemble a PATCH /users/me payload from the form. Drops blanks (only changed fields sent); validates email +
 * a non-empty trimmed name. Returns `empty` if nothing to change. The server re-validates (zod .strict). */
export function buildProfilePatch(form: ProfileForm): ProfileDraft {
  const patch: ProfilePatch = {};
  const name = (form.fullName ?? '').trim();
  if (name) { if (name.length > 200) return { ok: false, reason: 'name' }; patch.fullName = name; }
  const lang = (form.languageCode ?? '').trim();
  if (lang) patch.languageCode = lang;
  const email = (form.email ?? '').trim();
  if (email) { if (!isValidEmail(email)) return { ok: false, reason: 'email' }; patch.email = email; }
  if (Object.keys(patch).length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, patch };
}

// --- support tickets ---
export const TICKET_SEVERITIES: TicketSeverity[] = ['P0', 'P1', 'P2', 'P3'];
export function ticketStatusTone(status: TicketStatus | string): PillTone {
  switch (status) {
    case 'resolved': case 'closed': return 'success';
    case 'escalated': return 'danger';
    case 'pending_customer': case 'pending_internal': return 'warning';
    case 'open': case 'reopened': return 'info';
    default: return 'neutral';
  }
}
export function severityTone(sev: TicketSeverity | string): PillTone {
  switch (sev) { case 'P0': return 'danger'; case 'P1': return 'warning'; case 'P2': return 'info'; default: return 'neutral'; }
}
/** CSAT is only meaningful once the ticket is resolved/closed. */
export function canRateCsat(status: TicketStatus | string): boolean { return status === 'resolved' || status === 'closed'; }

export type SlaState = 'met' | 'due' | 'breached' | 'none';
/** Resolution-SLA read-out (UX only; the server is the authority on the clock): met if resolved before due,
 * breached if past due + unresolved, due if pending and within window. `now` injectable for tests. */
export function resolutionSlaState(t: Pick<SupportTicket, 'slaResolutionDue' | 'resolvedAt'>, now: number = Date.now()): SlaState {
  const due = t.slaResolutionDue ? Date.parse(t.slaResolutionDue) : NaN;
  const resolved = t.resolvedAt ? Date.parse(t.resolvedAt) : NaN;
  if (!Number.isNaN(resolved)) return Number.isNaN(due) || resolved <= due ? 'met' : 'breached';
  if (Number.isNaN(due)) return 'none';
  return now > due ? 'breached' : 'due';
}

export interface TicketForm { subject?: string; categoryId?: string | null; severity?: string }
export interface TicketInput { subject?: string; categoryId?: string; severity: TicketSeverity }
export interface TicketDraft { ok: boolean; input?: TicketInput; reason?: 'empty' | 'severity' }
/** Validate + assemble an open-ticket payload. Needs a subject (or a category); severity defaults to P2. */
export function buildTicketDraft(form: TicketForm): TicketDraft {
  const subject = (form.subject ?? '').trim().slice(0, 250);
  const categoryId = form.categoryId ?? undefined;
  if (!subject && !categoryId) return { ok: false, reason: 'empty' };
  const severity = (form.severity ?? 'P2') as TicketSeverity;
  if (!TICKET_SEVERITIES.includes(severity)) return { ok: false, reason: 'severity' };
  return { ok: true, input: { subject: subject || undefined, categoryId, severity } };
}

// --- land parcels ---
const AREA_RE = /^\d{1,6}(\.\d{1,4})?$/;
export function parcelAreaLabel(p: Pick<LandParcel, 'area' | 'areaUnit'>): string { return `${p.area} ${p.areaUnit}`; }
export function parcelStatusTone(status: string): PillTone {
  switch (status) { case 'verified': return 'success'; case 'rejected': return 'danger'; case 'pending': return 'warning'; default: return 'neutral'; }
}
export interface ParcelForm { areaValue?: string; areaUnit?: string; surveyNo?: string; regionId?: string }
export interface ParcelInput { areaValue: string; areaUnit: string; surveyNo?: string; regionId?: string }
export interface ParcelDraft { ok: boolean; input?: ParcelInput; reason?: 'area' }
/** Validate + assemble a register-parcel payload. `areaValue` is a positive decimal (≤4 dp), NOT money. */
export function buildParcelDraft(form: ParcelForm): ParcelDraft {
  const areaValue = (form.areaValue ?? '').trim();
  if (!AREA_RE.test(areaValue) || Number(areaValue) <= 0) return { ok: false, reason: 'area' };
  return { ok: true, input: { areaValue, areaUnit: (form.areaUnit || 'acre').trim(), surveyNo: (form.surveyNo ?? '').trim() || undefined, regionId: form.regionId } };
}

// --- bank accounts (display only; never the raw number) ---
/** A masked, human label for a saved payout destination — last-4/IFSC for a bank, the VPA for UPI. */
export function bankLabel(a: Pick<BankAccount, 'accountKind' | 'upiId' | 'accountLast4' | 'ifsc'>): string {
  if (a.accountKind === 'upi') return a.upiId ?? 'UPI';
  const last4 = a.accountLast4 ? `••••${a.accountLast4}` : '••••';
  return a.ifsc ? `${last4} · ${a.ifsc}` : last4;
}
/** UPI VPA validation (a VPA is a public payment address, not a secret): name@handle, bounded. */
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
export function isValidVpa(vpa: string): boolean { return VPA_RE.test((vpa ?? '').trim()); }
