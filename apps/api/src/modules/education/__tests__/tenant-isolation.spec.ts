// modules/education/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// courses/instructors/enrollments bind tenant_id (+ allow NULL platform rows for courses/instructors); lists are
// keyset (never OFFSET); mutations lock FOR UPDATE. course_lessons + lesson_progress are gated via the
// tenant-scoped course/enrollment JOIN (no tenant_id of their own).
import { CourseRepository } from '../repositories/course.repository';
import { InstructorRepository } from '../repositories/instructor.repository';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { CourseLessonRepository } from '../repositories/course-lesson.repository';
import { Course } from '../domain/course.entity';
import { Enrollment } from '../domain/enrollment.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const course = () => Course.create({ id: 'c1', tenantId: 'tenantA', instructorId: 'i1', defaultTitle: 'X', topicId: null, audienceRoleIds: [], level: 'basic', priceMinor: 0n, currencyCode: 'INR', certEnabled: false, coverMediaId: null });
const enrollment = () => Enrollment.enroll({ id: 'e1', tenantId: 'tenantA', courseId: 'c1', learnerUserId: 'u1', paymentId: null });

describe('courses isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CourseRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'c1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['c1', 'tenantA']);
  });
  it('browse list scopes to tenant OR platform, published only, keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new CourseRepository(provider).listFor('tenantA', { box: 'browse', limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/\(tenant_id=\$1 OR tenant_id IS NULL\)/); expect(sql).toMatch(/status='published'/);
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new CourseRepository(fakeReplica().provider).insert(tx as any, course(), 'tenantA', 'u1');
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO courses/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
  });
});

describe('instructors isolation', () => {
  it('findByUser binds user_id + tenant_id', async () => {
    const { provider, exec } = fakeReplica();
    await new InstructorRepository(provider).findByUser('tenantA', 'u1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/user_id=\$1 AND tenant_id=\$2/); expect(params).toEqual(['u1', 'tenantA']);
  });
});

describe('enrollments isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE; list keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new EnrollmentRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'e1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const { provider, exec } = fakeReplica();
    await new EnrollmentRepository(provider).listForLearner('tenantA', 'u1', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1 AND learner_user_id=\$2/); expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
  it('insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new EnrollmentRepository(fakeReplica().provider).insert(tx as any, enrollment());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO enrollments/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
  });
});

describe('course_lessons gated via the course join', () => {
  it('listForCourse joins courses on tenant_id (no cross-tenant leak)', async () => {
    const { provider, exec } = fakeReplica();
    await new CourseLessonRepository(provider).listForCourse('tenantA', 'c1');
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/JOIN courses c ON c\.id=l\.course_id/); expect(sql).toMatch(/c\.tenant_id=\$2 OR c\.tenant_id IS NULL/);
  });
});
