// modules/education/domain/lesson-progress.entity.ts · per-lesson progress within an enrollment (PK enrollment+lesson).
import { DomainEvent, EducationEventType } from './education.events';

export interface LessonProgressProps {
  enrollmentId: string; lessonId: string; completedAt: Date | null; secondsWatched: number; quizScore: number | null;
}
export class LessonProgress {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LessonProgressProps) {}

  static record(input: { enrollmentId: string; lessonId: string; secondsWatched: number; quizScore: number | null; completed: boolean }): LessonProgress {
    const lp = new LessonProgress({ enrollmentId: input.enrollmentId, lessonId: input.lessonId, secondsWatched: Math.max(0, Math.trunc(input.secondsWatched)), quizScore: input.quizScore, completedAt: input.completed ? new Date() : null });
    if (input.completed) lp.events.push({ type: EducationEventType.LessonCompleted, payload: { enrollmentId: input.enrollmentId, lessonId: input.lessonId } });
    return lp;
  }
  static rehydrate(p: LessonProgressProps): LessonProgress { return new LessonProgress(p); }
  get isCompleted() { return this.props.completedAt !== null; }
  toProps(): Readonly<LessonProgressProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { lessonId: v.lessonId, completedAt: v.completedAt, secondsWatched: v.secondsWatched, quizScore: v.quizScore }; }
}
