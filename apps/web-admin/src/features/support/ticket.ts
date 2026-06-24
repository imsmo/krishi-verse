// apps/web-admin/src/features/support/ticket.ts · PURE, framework-free helpers + types for the god-mode support-
// oversight console. No fetch, no React → unit-tested. MIRRORS admin-api support-oversight: the ticket status
// state machine (ticket.state) + severity SLA model (sla) + the escalation rules (raise-only severity, can't
// escalate a resolved/closed ticket, must change something). Support is a HELPDESK — money-free; no money paths.

// Mirrors admin-api domain/ticket.state.ts.
export const TICKET_STATUSES = ['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed', 'reopened'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function ticketStatusKey(s: string | null | undefined): TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(s ?? '') ? (s as TicketStatus) : 'open';
}
/** A resolved/closed ticket can't be escalated (mirrors isTerminalForEscalation). */
export function isTerminalForEscalation(s: TicketStatus): boolean { return s === 'resolved' || s === 'closed'; }
/** The escalate form is offered only when the ticket is still escalatable. */
export function canEscalate(s: TicketStatus): boolean { return !isTerminalForEscalation(s); }

// Mirrors admin-api domain/sla.ts. Lower rank = higher priority (P0 most urgent).
export const SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export type Severity = (typeof SEVERITIES)[number];
export function severityRank(s: Severity): number { return SEVERITIES.indexOf(s); }
export function severityKey(s: string | null | undefined): Severity {
  return (SEVERITIES as readonly string[]).includes(s ?? '') ? (s as Severity) : 'P3';
}
/** The legal raise targets from a current severity — strictly higher priority (lower rank). Escalation can only
 *  RAISE priority (mirrors assertSeverityRaise), so these are the only severities the escalate form may offer. */
export function higherSeverities(current: Severity): Severity[] {
  const r = severityRank(current);
  return SEVERITIES.filter((s) => severityRank(s) < r);
}

export function validReason(r: string | null | undefined): boolean {
  const v = (r ?? '').trim();
  return v.length >= 3 && v.length <= 1000;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string | null | undefined): boolean { return UUID_RE.test((v ?? '').trim()); }

export type EscalateResult =
  | { ok: true; value: { severity?: Severity; reassignToUserId?: string; reason: string } }
  | { ok: false; error: 'severity' | 'reassign' | 'reason' };

/** Build the escalate payload. severity (optional) must be a known severity; reassignToUserId (optional) must be a
 *  UUID; reason is mandatory. The server enforces raise-only + must-change + state-machine legality (and may 422). */
export function buildEscalate(raw: { severity?: string; reassignToUserId?: string; reason?: string }): EscalateResult {
  const sev = (raw.severity ?? '').trim();
  if (sev && !(SEVERITIES as readonly string[]).includes(sev)) return { ok: false, error: 'severity' };
  const reassign = (raw.reassignToUserId ?? '').trim();
  if (reassign && !isUuid(reassign)) return { ok: false, error: 'reassign' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return {
    ok: true,
    value: {
      ...(sev ? { severity: sev as Severity } : {}),
      ...(reassign ? { reassignToUserId: reassign } : {}),
      reason: (raw.reason ?? '').trim(),
    },
  };
}

// ---- SLA badge key (from the server-computed sla state) ----
export interface TicketSla { firstResponseBreached: boolean; resolutionBreached: boolean; breached: boolean }
export type SlaKey = 'breached' | 'ok';
export function slaKey(sla: TicketSla | null | undefined): SlaKey { return sla?.breached ? 'breached' : 'ok'; }

// ---- age formatting (float-free integer math; for the tenant-health "oldest open" age) ----
export interface AgeParts { days: number; hours: number; minutes: number }
export function ageParts(seconds: number | null | undefined): AgeParts | null {
  if (seconds == null || seconds < 0) return null;
  const s = Math.floor(seconds);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60) };
}

// ---- read-model shapes (mirror admin-api support-oversight read models; type-only, no runtime) ----
export interface TicketRow {
  id: string; tenantId: string | null; ticketNo: string; requesterUserId: string | null; channel: string; categoryId: string | null;
  severity: Severity; subject: string | null; status: TicketStatus; assigneeUserId: string | null;
  slaFirstResponseDue: string | null; slaResolutionDue: string | null; firstRespondedAt: string | null; resolvedAt: string | null;
  createdAt: string | null; sla: TicketSla;
}
export interface TenantHealthRow { tenantId: string; openCount: number; breachedCount: number; p0Open: number; oldestOpenAgeSec: number | null }
