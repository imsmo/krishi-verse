// modules/education/services/enrollment.service.ts · THE ENROLLMENT MONEY PATH.
// Free course → instant enrollment. Paid course → the learner buys a seat: a ZERO-SUM, idempotent
// 'course_purchase' wallet transfer — learner userMain → instructor userMain (royalty_bps, floored) + platform
// Fees (remainder) — posted in the SAME tx as the enrollment (Law 2 + Law 4). A learner can't enroll twice
// (UNIQUE course+learner) nor in their own course. authz: enroll needs only auth; reads are learner-owned (404).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { WALLET_SERVICE, WalletPort, LedgerLeg } from '../../../core/wallet/wallet.port';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Course } from '../domain/course.entity';
import { Enrollment } from '../domain/enrollment.entity';
import { DomainEvent, EducationEventType } from '../domain/education.events';
import { isEnrollable } from '../domain/course.state';
import { CourseRepository } from '../repositories/course.repository';
import { InstructorRepository } from '../repositories/instructor.repository';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { CourseNotFoundError, CourseNotPublishedError, AlreadyEnrolledError, CannotEnrollOwnCourseError, EnrollmentNotFoundError } from '../domain/education.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class EnrollmentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly courses: CourseRepository,
    private readonly instructors: InstructorRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  async enroll(tenantId: string, actor: EducationActor, courseId: string, idemKey: string) {
    return this.idem.remember(idemKey, actor.userId, 'education.enroll', () =>
      timed(this.metrics, 'education.enroll', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const course = await this.courses.getById(tenantId, courseId, tx);
          if (!course) throw new CourseNotFoundError(courseId);
          if (!isEnrollable(course.status)) throw new CourseNotPublishedError(course.status);
          const instructor = await this.instructors.getById(tenantId, course.instructorId, tx);
          if (instructor && instructor.userId === actor.userId) throw new CannotEnrollOwnCourseError();
          if (await this.enrollments.findByCourseLearner(tenantId, courseId, actor.userId, tx)) throw new AlreadyEnrolledError(courseId);

          const id = uuidv7();
          const enrollment = Enrollment.enroll({ id, tenantId, courseId, learnerUserId: actor.userId, paymentId: null });
          if (!course.isFree) {
            const royaltyBps = instructor?.royaltyBps ?? 0;
            const { instructorMinor, platformMinor } = Course.splitRevenue(course.priceMinor, royaltyBps);
            const legs: LedgerLeg[] = [{ account: userMain(actor.userId), amountMinor: -course.priceMinor }];
            if (instructor && instructorMinor > 0n) legs.push({ account: userMain(instructor.userId), amountMinor: instructorMinor });
            const platformShare = platformMinor + (instructor ? 0n : instructorMinor);   // no instructor user ⇒ all to platform
            if (platformShare > 0n) legs.push({ account: platform(PlatformAccount.Fees), amountMinor: platformShare });
            await this.wallet.post(tx, { tenantId, txnType: 'course_purchase', idempotencyKey: `coursebuy:${id}`, referenceType: 'enrollment', referenceId: id, initiatedBy: actor.userId, legs });
            enrollment.pullEvents();   // replace the plain Enrolled event with a CoursePurchased + Enrolled pair
            await this.outbox.write(tx, { tenantId, aggregateType: 'enrollment', aggregateId: id, eventType: EducationEventType.CoursePurchased, payload: { v: 1, enrollmentId: id, courseId, learnerUserId: actor.userId, priceMinor: course.priceMinor.toString(), instructorMinor: instructorMinor.toString() } });
            await this.outbox.write(tx, { tenantId, aggregateType: 'enrollment', aggregateId: id, eventType: EducationEventType.Enrolled, payload: { v: 1, enrollmentId: id, courseId, learnerUserId: actor.userId, paid: true } });
          }
          await this.enrollments.insert(tx, enrollment);
          if (course.isFree) await this.flush(tx, tenantId, id, enrollment.pullEvents());
          return { ...enrollment.toJSON(), pricePaidMinor: course.isFree ? '0' : course.priceMinor.toString() };
        }, { userId: actor.userId })));
  }

  async getById(tenantId: string, actor: EducationActor, id: string) {
    const e = await this.enrollments.getByIdForLearner(tenantId, actor.userId, id);
    if (!e) throw new EnrollmentNotFoundError(id);   // 404 for a non-owner (no IDOR)
    return e.toJSON();
  }
  async list(tenantId: string, actor: EducationActor, q: { completedOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.enrollments.listForLearner(tenantId, actor.userId, q);
    const items = rows.map((e) => e.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'enrollment', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
