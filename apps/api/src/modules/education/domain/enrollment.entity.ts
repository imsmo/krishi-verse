// modules/education/domain/enrollment.entity.ts · a learner's enrollment in a course. progress_pct is recomputed
// from lesson_progress (0..100); completed_at is stamped when it reaches 100. paymentId links a paid enrollment.
import { DomainEvent, EducationEventType } from './education.events';

export interface EnrollmentProps {
  id: string; tenantId: string; courseId: string; learnerUserId: string; paymentId: string | null;
  progressPct: number; completedAt: Date | null; certificateMediaId: string | null; createdAt?: Date;
}
export class Enrollment {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: EnrollmentProps) {}

  static enroll(input: Omit<EnrollmentProps, 'progressPct' | 'completedAt' | 'certificateMediaId'>): Enrollment {
    const e = new Enrollment({ ...input, progressPct: 0, completedAt: null, certificateMediaId: null });
    e.events.push({ type: EducationEventType.Enrolled, payload: { enrollmentId: e.props.id, courseId: e.props.courseId, learnerUserId: e.props.learnerUserId, paid: e.props.paymentId !== null } });
    return e;
  }
  static rehydrate(p: EnrollmentProps): Enrollment { return new Enrollment(p); }
  get id() { return this.props.id; }
  get courseId() { return this.props.courseId; }
  get learnerUserId() { return this.props.learnerUserId; }
  get progressPct() { return this.props.progressPct; }
  get isComplete() { return this.props.completedAt !== null; }
  toProps(): Readonly<EnrollmentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Recompute progress from completed/total lessons; stamp completion exactly once. Returns true if newly done. */
  recompute(completedLessons: number, totalLessons: number): boolean {
    const pct = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 10000) / 100;   // 2dp, no float drift in storage
    this.props.progressPct = pct;
    if (pct >= 100 && !this.props.completedAt) {
      this.props.completedAt = new Date();
      this.events.push({ type: EducationEventType.CourseCompleted, payload: { enrollmentId: this.props.id, courseId: this.props.courseId, learnerUserId: this.props.learnerUserId } });
      return true;
    }
    return false;
  }
  attachCertificate(mediaId: string): void { this.props.certificateMediaId = mediaId; }
  toJSON() { const v = this.props; return { id: v.id, courseId: v.courseId, learnerUserId: v.learnerUserId, paymentId: v.paymentId, progressPct: v.progressPct, completedAt: v.completedAt, certificateMediaId: v.certificateMediaId, createdAt: v.createdAt }; }
}
