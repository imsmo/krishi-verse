// modules/education/__tests__/enrollment.service.spec.ts · EnrollmentService unit tests with fakes.
// Pins: free course = instant enroll (no wallet); paid course = a ZERO-SUM learner→instructor(royalty)+platform
// transfer in-tx (txnType course_purchase); can't enroll an unpublished course or your own; double-enroll 409;
// reads 404 for a non-owner (no IDOR).
import { EnrollmentService } from '../services/enrollment.service';
import { Course } from '../domain/course.entity';
import { Instructor } from '../domain/instructor.entity';
import { CourseNotPublishedError, CannotEnrollOwnCourseError, AlreadyEnrolledError, EnrollmentNotFoundError } from '../domain/education.errors';

const course = (over: Partial<any> = {}) => Course.rehydrate({ id: 'c1', tenantId: 't1', instructorId: 'i1', defaultTitle: 'Soil', topicId: null, audienceRoleIds: [], level: 'basic', priceMinor: 50000n, currencyCode: 'INR', certEnabled: false, coverMediaId: null, status: 'published', ...over });
const instructor = (over: Partial<any> = {}) => Instructor.rehydrate({ id: 'i1', userId: 'instr', tenantId: 't1', bio: null, royaltyBps: 8000, isVerified: true, ...over });

function harness(opts: { course?: Course | null; instructor?: Instructor | null; existing?: boolean } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 'tx1', alreadyApplied: false })) };
  const courses = { getById: jest.fn(async () => (opts.course === undefined ? course() : opts.course)) };
  const instructors = { getById: jest.fn(async () => (opts.instructor === undefined ? instructor() : opts.instructor)) };
  const enrollments = { findByCourseLearner: jest.fn(async () => (opts.existing ? {} : null)), insert: jest.fn(), getByIdForLearner: jest.fn(async () => null) };
  const svc = new EnrollmentService(uow as any, outbox as any, idem as any, metrics as any, wallet as any, courses as any, instructors as any, enrollments as any);
  return { svc, wallet, enrollments };
}
const learner = { userId: 'learner', canAuthor: false, canPublish: false, isAdmin: false, canHost: false, canModerate: false };

describe('EnrollmentService.enroll', () => {
  it('free course → instant enroll, no wallet movement', async () => {
    const { svc, wallet, enrollments } = harness({ course: course({ priceMinor: 0n }) });
    const out = await svc.enroll('t1', learner, 'c1', 'idem-1');
    expect(wallet.post).not.toHaveBeenCalled();
    expect(enrollments.insert).toHaveBeenCalledTimes(1); expect(out.pricePaidMinor).toBe('0');
  });
  it('paid course → ZERO-SUM learner→instructor(80%)+platform transfer in-tx', async () => {
    const { svc, wallet } = harness();
    const out = await svc.enroll('t1', learner, 'c1', 'idem-2');
    expect(wallet.post).toHaveBeenCalledTimes(1);
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('course_purchase'); expect(arg.idempotencyKey).toMatch(/^coursebuy:/);
    const sum = arg.legs.reduce((a: bigint, l: any) => a + l.amountMinor, 0n);
    expect(sum).toBe(0n);                                                            // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor < 0n).account.userId).toBe('learner');  // learner debited
    expect(arg.legs.find((l: any) => l.account.userId === 'instr').amountMinor).toBe(40000n); // 80% of 50000
    expect(out.pricePaidMinor).toBe('50000');
  });
  it('rejects an unpublished course', async () => {
    const { svc } = harness({ course: course({ status: 'draft' }) });
    await expect(svc.enroll('t1', learner, 'c1', 'idem-3')).rejects.toBeInstanceOf(CourseNotPublishedError);
  });
  it('rejects enrolling in your own course', async () => {
    const { svc } = harness({ instructor: instructor({ userId: 'learner' }) });
    await expect(svc.enroll('t1', learner, 'c1', 'idem-4')).rejects.toBeInstanceOf(CannotEnrollOwnCourseError);
  });
  it('rejects a double enrollment', async () => {
    const { svc } = harness({ existing: true });
    await expect(svc.enroll('t1', learner, 'c1', 'idem-5')).rejects.toBeInstanceOf(AlreadyEnrolledError);
  });
  it('getById 404s a non-owner (no IDOR)', async () => {
    const { svc } = harness();
    await expect(svc.getById('t1', learner, 'someone-elses')).rejects.toBeInstanceOf(EnrollmentNotFoundError);
  });
});
