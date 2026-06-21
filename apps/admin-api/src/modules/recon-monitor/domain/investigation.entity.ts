// apps/admin-api/src/modules/recon-monitor/domain/investigation.entity.ts · the recon-investigation entity.
// Pure domain, no I/O. Status changes go ONLY through investigation.state.ts (Law 5); each transition returns
// {from,to} for the audit row. resolve()/markFalsePositive() are terminal and stamp resolved_at.
import { InvestigationStatus, assertTransition, isTerminal } from './investigation.state';

export interface InvestigationProps {
  id: string;
  runId: string;
  status: InvestigationStatus;
  severity: string;
  summary: string;
  assignedTo: string | null;
  resolutionNote: string | null;
  openedBy: string;
  resolvedAt: Date | null;
  createdAt?: Date | null;
}

export class Investigation {
  private constructor(private props: InvestigationProps) {}
  static rehydrate(p: InvestigationProps): Investigation { return new Investigation(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }

  private move(to: InvestigationStatus): { from: InvestigationStatus; to: InvestigationStatus } {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    if (isTerminal(to)) this.props.resolvedAt = new Date();
    return { from, to };
  }

  startInvestigating(assignedTo: string | null): { from: InvestigationStatus; to: InvestigationStatus } {
    const c = this.move('investigating');
    if (assignedTo) this.props.assignedTo = assignedTo;
    return c;
  }
  resolve(note: string): { from: InvestigationStatus; to: InvestigationStatus } {
    const c = this.move('resolved');
    this.props.resolutionNote = note;
    return c;
  }
  markFalsePositive(note: string): { from: InvestigationStatus; to: InvestigationStatus } {
    const c = this.move('false_positive');
    this.props.resolutionNote = note;
    return c;
  }

  get resolvedAt() { return this.props.resolvedAt; }
  get assignedTo() { return this.props.assignedTo; }
  get resolutionNote() { return this.props.resolutionNote; }

  toJSON() {
    const v = this.props;
    return { id: v.id, runId: v.runId, status: v.status, severity: v.severity, summary: v.summary,
      assignedTo: v.assignedTo, resolutionNote: v.resolutionNote, openedBy: v.openedBy,
      resolvedAt: v.resolvedAt, createdAt: v.createdAt ?? null };
  }
}
