// modules/education/services/lesson-progress.service.ts · record per-lesson progress + recompute completion.
// Learner-owned (a non-owner enrollment 404s — no IDOR). The lesson must belong to the enrollment's course
// (anti-IDOR across courses). progress_pct is recomputed from distinct completed lessons; reaching 100 stamps
// completed_at + emits CourseCompleted exactly once (idempotent).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { LessonProgress } from '../domain/lesson-progress.entity';
import { DomainEvent } from '../domain/education.events';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { LessonProgressRepository } from '../repositories/lesson-progress.repository';
import { CourseLessonRepository } from '../repositories/course-lesson.repository';
import { MarkProgressDto } from '../dto/mark-lesson-progress.dto';
import { EnrollmentNotFoundError, LessonNotFoundError } from '../domain/education.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class LessonProgressService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly enrollments: EnrollmentRepository,
    private readonly progress: LessonProgressRepository,
    private readonly lessons: CourseLessonRepository,
  ) {}

  async mark(tenantId: string, actor: EducationActor, enrollmentId: string, lessonId: string, dto: MarkProgressDto) {
    return timed(this.metrics, 'education.lesson.progress', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const enrollment = await this.enrollments.getForUpdate(tx, tenantId, enrollmentId);
        if (!enrollment || enrollment.learnerUserId !== actor.userId) throw new EnrollmentNotFoundError(enrollmentId);   // 404, no IDOR
        const courseLessons = await this.lessons.listForCourse(tenantId, enrollment.courseId, tx);
        if (!courseLessons.some((l) => l.id === lessonId)) throw new LessonNotFoundError(lessonId);   // lesson not in this course
        const lp = LessonProgress.record({ enrollmentId, lessonId, secondsWatched: dto.secondsWatched, quizScore: dto.quizScore ?? null, completed: dto.completed });
        await this.progress.upsert(tx, lp);
        const completed = await this.progress.countCompleted(tx, enrollmentId);
        enrollment.recompute(completed, courseLessons.length);
        await this.enrollments.update(tx, enrollment);
        const evts: DomainEvent[] = [...lp.pullEvents(), ...enrollment.pullEvents()];
        for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'enrollment', aggregateId: enrollmentId, eventType: e.type, payload: { v: 1, ...e.payload } });
        return { lesson: lp.toJSON(), enrollment: enrollment.toJSON() };
      }, { userId: actor.userId }));
  }
  async listForEnrollment(tenantId: string, actor: EducationActor, enrollmentId: string) {
    const e = await this.enrollments.getByIdForLearner(tenantId, actor.userId, enrollmentId);
    if (!e) throw new EnrollmentNotFoundError(enrollmentId);
    return (await this.progress.listForEnrollment(tenantId, enrollmentId)).map((lp) => lp.toJSON());
  }
}
