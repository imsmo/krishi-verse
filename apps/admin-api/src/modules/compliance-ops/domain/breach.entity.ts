// apps/admin-api/src/modules/compliance-ops/domain/breach.entity.ts · the DPDP breach incident entity. Pure
// domain, no I/O. Status moves go ONLY through breach.state.ts (Law 5); each transition returns {from,to} for
// the audit and stamps the relevant timestamp (contained_at / notified_at / closed_at). Mirrors data_breaches
// (0034). "notified" requires that BOTH the regulator and the data principals have been recorded as notified
// (DPDP §8) — enforced here.
import { BreachStatus, assertTransition, isTerminal } from './breach.state';
import { InvalidRetentionPolicyError } from './compliance-ops.errors';

export interface BreachProps {
  id: string;
  affectedTenantId: string | null;
  status: BreachStatus;
  severity: string;
  title: string;
  affectedCount: number;
  detectedAt: Date;
  containedAt: Date | null;
  regulatorNotifiedAt: Date | null;
  principalsNotifiedAt: Date | null;
  closedAt: Date | null;
  resolutionNote: string | null;
  createdAt?: Date | null;
}

export class Breach {
  private constructor(private props: BreachProps) {}
  static rehydrate(p: BreachProps): Breach { return new Breach(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }

  private move(to: BreachStatus): { from: BreachStatus; to: BreachStatus } {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    return { from, to };
  }

  contain(now: Date = new Date()): { from: BreachStatus; to: BreachStatus } {
    const c = this.move('contained');
    this.props.containedAt = now;
    return c;
  }

  /** Mark notified — both the regulator AND data principals must already be recorded as notified (DPDP §8). */
  markNotified(regulatorNotifiedAt: Date, principalsNotifiedAt: Date): { from: BreachStatus; to: BreachStatus } {
    const c = this.move('notified');
    this.props.regulatorNotifiedAt = regulatorNotifiedAt;
    this.props.principalsNotifiedAt = principalsNotifiedAt;
    return c;
  }

  close(note: string, now: Date = new Date()): { from: BreachStatus; to: BreachStatus } {
    const c = this.move('closed');
    this.props.closedAt = now;
    this.props.resolutionNote = note;
    return c;
  }

  get isTerminal() { return isTerminal(this.props.status); }

  toJSON() {
    const v = this.props;
    return { id: v.id, affectedTenantId: v.affectedTenantId, status: v.status, severity: v.severity, title: v.title,
      affectedCount: v.affectedCount, detectedAt: v.detectedAt, containedAt: v.containedAt,
      regulatorNotifiedAt: v.regulatorNotifiedAt, principalsNotifiedAt: v.principalsNotifiedAt,
      closedAt: v.closedAt, resolutionNote: v.resolutionNote, createdAt: v.createdAt ?? null };
  }
}

// Pure validation for a retention policy upsert (config — no state machine). Bounds the numeric windows.
export function assertRetentionPolicy(activeMonths: number, archiveMonths: number | null, action: string): void {
  if (!Number.isInteger(activeMonths) || activeMonths < 0 || activeMonths > 1200) throw new InvalidRetentionPolicyError('active_months must be 0..1200');
  if (archiveMonths != null && (!Number.isInteger(archiveMonths) || archiveMonths < 0 || archiveMonths > 1200)) throw new InvalidRetentionPolicyError('archive_months must be 0..1200 or null');
  if (!['archive', 'anonymise', 'delete', 'keep_forever'].includes(action)) throw new InvalidRetentionPolicyError('invalid action');
}
