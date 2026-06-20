// modules/ai-governance/domain/moderation-report.entity.ts · a content abuse report (moderation_reports,
// tenant-scoped). Pure domain. Filed by a user (reporter_user_id) or by the system (NULL = AI/automation).
// A moderator handles it: open → actioned (with an action_taken) | dismissed. State moves ONLY through
// moderation.state.ts (Law 5). No version column → the repo locks the row FOR UPDATE on handle.
import { ModerationStatus, ModerationAction, DomainEvent, AiEventType } from './ai-governance.events';
import { assertTransition } from './moderation.state';
import { InvalidModerationError } from './ai-governance.errors';

export interface ModerationReportProps {
  id: string; tenantId: string; reporterUserId: string | null; subjectType: string; subjectId: string;
  reasonId: string; details: string | null; status: ModerationStatus; actionTaken: ModerationAction | null;
  handledBy: string | null; handledAt: Date | null; createdAt?: Date;
}
const SUBJECT_TYPES = new Set(['listing', 'review', 'message', 'user', 'resource', 'channel', 'live_session']);

export class ModerationReport {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ModerationReportProps) {}

  static file(input: { id: string; tenantId: string; reporterUserId: string | null; subjectType: string;
    subjectId: string; reasonId: string; details?: string | null; }): ModerationReport {
    if (!SUBJECT_TYPES.has(input.subjectType)) throw new InvalidModerationError(`unsupported subjectType "${input.subjectType}"`);
    if (!input.reasonId) throw new InvalidModerationError('reasonId required');
    const r = new ModerationReport({ ...input, details: input.details ?? null, status: 'open', actionTaken: null, handledBy: null, handledAt: null });
    r.events.push({ type: AiEventType.ModerationFiled, payload: { reportId: r.props.id, subjectType: r.props.subjectType, subjectId: r.props.subjectId } });
    return r;
  }
  static rehydrate(p: ModerationReportProps): ModerationReport { return new ModerationReport(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  toProps(): Readonly<ModerationReportProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Moderator decision. status='actioned' requires an action; 'dismissed' takes none. */
  handle(by: string, status: 'actioned' | 'dismissed', action: ModerationAction | null, now = new Date()): void {
    assertTransition(this.props.status, status);
    if (status === 'actioned' && (!action || action === 'none')) throw new InvalidModerationError('actioned requires an action_taken');
    this.props.status = status;
    this.props.actionTaken = status === 'actioned' ? action : null;
    this.props.handledBy = by;
    this.props.handledAt = now;
    this.events.push({ type: AiEventType.ModerationActioned, payload: { reportId: this.props.id, subjectType: this.props.subjectType, subjectId: this.props.subjectId, status, actionTaken: this.props.actionTaken, handledBy: by } });
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, reporterUserId: v.reporterUserId, subjectType: v.subjectType, subjectId: v.subjectId,
      reasonId: v.reasonId, details: v.details, status: v.status, actionTaken: v.actionTaken, handledBy: v.handledBy,
      handledAt: v.handledAt, createdAt: v.createdAt };
  }
}
