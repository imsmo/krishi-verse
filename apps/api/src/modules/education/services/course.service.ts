// modules/education/services/course.service.ts · course authoring + lifecycle + lessons.
// One ACID tx per write (UoW), outbox in-tx (Law 4). authz THROWS (Law 6): only the course's OWN instructor may
// edit/add lessons (anti-IDOR); publishing needs course.publish. price_minor is bigint minor units (Law 2).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Course } from '../domain/course.entity';
import { CourseLesson } from '../domain/course-lesson.entity';
import { DomainEvent, CourseLevel, ContentKind } from '../domain/education.events';
import { CourseRepository } from '../repositories/course.repository';
import { CourseLessonRepository } from '../repositories/course-lesson.repository';
import { InstructorRepository } from '../repositories/instructor.repository';
import { CreateCourseDto, UpdateCourseDto } from '../dto/create-course.dto';
import { UpsertLessonDto } from '../dto/create-course-lesson.dto';
import { CourseNotFoundError, LessonNotFoundError, InstructorNotFoundError, EducationForbiddenError } from '../domain/education.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class CourseService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: CourseRepository,
    private readonly lessons: CourseLessonRepository,
    private readonly instructors: InstructorRepository,
  ) {}

  async create(tenantId: string, actor: EducationActor, dto: CreateCourseDto) {
    if (!actor.canAuthor) throw new EducationForbiddenError('requires course.author');
    return timed(this.metrics, 'education.course.create', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const instructor = await this.instructors.findByUser(tenantId, actor.userId, tx);
        if (!instructor) throw new InstructorNotFoundError('me');   // must have an instructor profile first
        const c = Course.create({ id: uuidv7(), tenantId, instructorId: instructor.id, defaultTitle: dto.defaultTitle, topicId: dto.topicId ?? null,
          audienceRoleIds: dto.audienceRoleIds, level: dto.level as CourseLevel, priceMinor: BigInt(dto.priceMinor), currencyCode: 'INR', certEnabled: dto.certEnabled, coverMediaId: dto.coverMediaId ?? null });
        await this.repo.insert(tx, c, tenantId, actor.userId);
        return c.toJSON();
      }, { userId: actor.userId }));
  }
  async update(tenantId: string, actor: EducationActor, id: string, dto: UpdateCourseDto) {
    return this.mutate(tenantId, actor, id, (c) => c.update({ ...dto, priceMinor: dto.priceMinor !== undefined ? BigInt(dto.priceMinor) : undefined, level: dto.level as CourseLevel | undefined }));
  }
  async setStatus(tenantId: string, actor: EducationActor, id: string, action: 'submit' | 'publish' | 'pause' | 'archive') {
    if ((action === 'publish' || action === 'pause') && !actor.canPublish) throw new EducationForbiddenError('requires course.publish');
    return this.mutate(tenantId, actor, id, (c) => { if (action === 'submit') c.submitForReview(); else if (action === 'publish') c.publish(); else if (action === 'pause') c.pause(); else c.archive(); }, action === 'publish' || action === 'pause');
  }
  async getById(tenantId: string, id: string) {
    const c = await this.repo.getById(tenantId, id);
    if (!c) throw new CourseNotFoundError(id);
    const lessons = await this.lessons.listForCourse(tenantId, id);
    return { ...c.toJSON(), lessons: lessons.map((l) => l.toJSON()) };
  }
  async list(tenantId: string, actor: EducationActor, q: { box: 'browse' | 'mine' | 'all'; topicId?: string; level?: string; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new EducationForbiddenError('requires course.publish');
    let instructorId: string | undefined;
    if (q.box === 'mine') { const me = await this.instructors.findByUser(tenantId, actor.userId); if (!me) return { items: [], nextCursor: null }; instructorId = me.id; }
    const rows = await this.repo.listFor(tenantId, { box: q.box, instructorId, topicId: q.topicId, level: q.level, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((c) => c.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async upsertLesson(tenantId: string, actor: EducationActor, courseId: string, dto: UpsertLessonDto) {
    if (!actor.canAuthor) throw new EducationForbiddenError('requires course.author');
    return this.uow.run(tenantId, async (tx) => {
      const course = await this.repo.getForUpdate(tx, tenantId, courseId);
      if (!course) throw new CourseNotFoundError(courseId);
      await this.assertOwner(tenantId, actor, course, tx);
      const lesson = CourseLesson.create({ id: uuidv7(), courseId, moduleNo: dto.moduleNo, lessonNo: dto.lessonNo, defaultTitle: dto.defaultTitle,
        contentKind: dto.contentKind as ContentKind, mediaId: dto.mediaId ?? null, body: dto.body ?? null, durationSecs: dto.durationSecs ?? null, quiz: dto.quiz ?? null });
      await this.lessons.upsert(tx, lesson, actor.userId);
      return lesson.toJSON();
    }, { userId: actor.userId });
  }
  async listLessons(tenantId: string, courseId: string) {
    const c = await this.repo.getById(tenantId, courseId);
    if (!c) throw new CourseNotFoundError(courseId);
    return (await this.lessons.listForCourse(tenantId, courseId)).map((l) => l.toJSON());
  }

  private async mutate(tenantId: string, actor: EducationActor, id: string, fn: (c: Course) => void, allowAdmin = false) {
    if (!actor.canAuthor && !actor.canPublish) throw new EducationForbiddenError('requires course.author');
    return this.uow.run(tenantId, async (tx) => {
      const c = await this.repo.getForUpdate(tx, tenantId, id);
      if (!c) throw new CourseNotFoundError(id);
      await this.assertOwner(tenantId, actor, c, tx, allowAdmin);
      fn(c);
      await this.repo.update(tx, c, tenantId);
      await this.flush(tx, tenantId, c.id, c.pullEvents());
      return c.toJSON();
    }, { userId: actor.userId });
  }
  /** Only the course's own instructor may modify it (admins/editors may when allowAdmin). 404, not 403, on a
   *  non-owner non-admin so course ids can't be probed across instructors. */
  private async assertOwner(tenantId: string, actor: EducationActor, course: Course, tx: TxContext, allowAdmin = false): Promise<void> {
    if (allowAdmin && actor.isAdmin) return;
    const instructor = await this.instructors.getById(tenantId, course.instructorId, tx);
    if (!instructor || instructor.userId !== actor.userId) { if (actor.isAdmin && allowAdmin) return; throw new CourseNotFoundError(course.id); }
  }
  private async flush(tx: TxContext, tenantId: string | null, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'course', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
