// apps/admin-api/src/modules/support-oversight/domain/sla.ts · pure SLA math, MIRRORING apps/api support-ticket
// .entity SLA_MINUTES (PRD §50 helpdesk) so oversight's breach view matches what the tenant plane computed at open.
// A ticket is SLA-breached while it is still WORKING and past a due date that hasn't been satisfied:
//   • first-response breach: no first_responded_at AND now > sla_first_response_due
//   • resolution breach:     not resolved AND now > sla_resolution_due
import { TicketStatus, isWorking } from './ticket.state';
import { InvalidEscalationError } from './support-oversight.errors';

export const SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SLA_MINUTES: Readonly<Record<Severity, { firstResponse: number; resolution: number }>> = Object.freeze({
  P0: { firstResponse: 15, resolution: 240 },
  P1: { firstResponse: 60, resolution: 480 },
  P2: { firstResponse: 240, resolution: 1440 },
  P3: { firstResponse: 480, resolution: 4320 },
});

/** Lower rank = higher priority (P0=0 most urgent). */
export function severityRank(s: Severity): number { return SEVERITIES.indexOf(s); }

/** Escalation must RAISE priority (strictly lower rank). Throws InvalidEscalationError otherwise. */
export function assertSeverityRaise(from: Severity, to: Severity): void {
  if (severityRank(to) >= severityRank(from)) throw new InvalidEscalationError(`severity can only be raised (got ${from}→${to})`);
}

/** Recompute SLA due dates from a base time (the ticket's created_at) + severity. */
export function computeSla(severity: Severity, base: Date): { firstResponseDue: Date; resolutionDue: Date } {
  const m = SLA_MINUTES[severity];
  return { firstResponseDue: new Date(base.getTime() + m.firstResponse * 60_000), resolutionDue: new Date(base.getTime() + m.resolution * 60_000) };
}

export interface SlaInput {
  status: TicketStatus;
  slaFirstResponseDue: Date | null;
  slaResolutionDue: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
}
export interface SlaState { firstResponseBreached: boolean; resolutionBreached: boolean; breached: boolean; }

export function slaState(t: SlaInput, now: Date): SlaState {
  const working = isWorking(t.status);
  const frBreached = working && !t.firstRespondedAt && !!t.slaFirstResponseDue && now.getTime() > t.slaFirstResponseDue.getTime();
  const resBreached = working && !t.resolvedAt && !!t.slaResolutionDue && now.getTime() > t.slaResolutionDue.getTime();
  return { firstResponseBreached: frBreached, resolutionBreached: resBreached, breached: frBreached || resBreached };
}
