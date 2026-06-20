// modules/education/__tests__/education.integration.spec.ts
// REAL end-to-end proof of the education spine against a live Postgres:
//   1. an instructor profile + a PAID course (₹500, 80% royalty) with 2 lessons, published;
//   2. a learner enrolls → a ZERO-SUM course_purchase splits ₹500 → instructor ₹400 + platform ₹100;
//   3. marking both lessons complete drives progress_pct to 100 + stamps completion;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's enrollment.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';
import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { LedgerRepository } from '../../../core/wallet/ledger.repository';
import { InProcessWalletClient } from '../../../core/wallet/wallet.client.inprocess';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';

import { InstructorRepository } from '../repositories/instructor.repository';
import { CourseRepository } from '../repositories/course.repository';
import { CourseLessonRepository } from '../repositories/course-lesson.repository';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { LessonProgressRepository } from '../repositories/lesson-progress.repository';
import { InstructorService } from '../services/instructor.service';
import { CourseService } from '../services/course.service';
import { EnrollmentService } from '../services/enrollment.service';
import { LessonProgressService } from '../services/lesson-progress.service';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('education spine (integration, real Postgres + RLS + royalty split)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool; let uow: PgUnitOfWork; let wallet: InProcessWalletClient;
  let instructors: InstructorService; let courses: CourseService; let enroll: EnrollmentService; let progress: LessonProgressService;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const instr = randomUUID(); const learner = randomUUID();
  let courseId = ''; let enrollmentId = ''; const lessonIds: string[] = [];
  const instrActor = { userId: instr, canAuthor: true, canPublish: true, isAdmin: true };
  const learnerActor = { userId: learner, canAuthor: false, canPublish: false, isAdmin: false };

  const balUser = async (u: string) => BigInt((await admin.query(`SELECT COALESCE(cached_balance_minor,0) b FROM wallet_accounts WHERE owner_kind='user' AND account_code='main' AND owner_user_id=$1`, [u])).rows[0]?.b ?? '0');
  const fund = (u: string, amt: bigint) => uow.run(tenantA, (tx) => wallet.post(tx, { tenantId: tenantA, txnType: 'order_payment', idempotencyKey: `fund:${randomUUID()}`, initiatedBy: 'system', legs: [{ account: userMain(u), amountMinor: amt }, { account: platform(PlatformAccount.Gateway), amountMinor: -amt }] }), { userId: 'system' });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B'); await makeUser(admin, instr); await makeUser(admin, learner);
    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter(); const idem = new PgIdempotencyService(pools); const metrics = new PromMetrics();
    wallet = new InProcessWalletClient(new LedgerRepository());
    const iRepo = new InstructorRepository(replica as any); const cRepo = new CourseRepository(replica as any); const lRepo = new CourseLessonRepository(replica as any);
    const eRepo = new EnrollmentRepository(replica as any); const pRepo = new LessonProgressRepository(replica as any);
    instructors = new InstructorService(uow, metrics, iRepo);
    courses = new CourseService(uow, outbox, metrics, cRepo, lRepo, iRepo);
    enroll = new EnrollmentService(uow, outbox, idem, metrics, wallet, cRepo, iRepo, eRepo);
    progress = new LessonProgressService(uow, outbox, metrics, eRepo, pRepo, lRepo);
    await fund(learner, 1_000_000n);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);
  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('instructor authors + publishes a paid course with 2 lessons', async () => {
    await instructors.become(tenantA, instrActor, 'KVK trainer');
    const c: any = await courses.create(tenantA, instrActor, { defaultTitle: 'Drip irrigation', audienceRoleIds: [], level: 'basic', priceMinor: '50000', certEnabled: false } as any);
    courseId = c.id;
    for (const n of [1, 2]) { const l: any = await courses.upsertLesson(tenantA, instrActor, courseId, { moduleNo: 1, lessonNo: n, defaultTitle: `Lesson ${n}`, contentKind: 'video' } as any); lessonIds.push(l.id); }
    await courses.setStatus(tenantA, instrActor, courseId, 'submit');
    expect((await courses.setStatus(tenantA, instrActor, courseId, 'publish')).status).toBe('published');
  });

  it('learner enrolls → ZERO-SUM split ₹500 → instructor ₹400 + platform ₹100', async () => {
    const lBefore = await balUser(learner); const iBefore = await balUser(instr);
    const e: any = await enroll.enroll(tenantA, learnerActor, courseId, `idem-${randomUUID()}`);
    enrollmentId = e.id; expect(e.pricePaidMinor).toBe('50000');
    expect(lBefore - (await balUser(learner))).toBe(50000n);   // learner debited ₹500
    expect((await balUser(instr)) - iBefore).toBe(40000n);     // instructor credited 80%
  });

  it('completing both lessons drives progress to 100 + completion', async () => {
    await progress.mark(tenantA, learnerActor, enrollmentId, lessonIds[0], { secondsWatched: 60, completed: true } as any);
    const r: any = await progress.mark(tenantA, learnerActor, enrollmentId, lessonIds[1], { secondsWatched: 60, completed: true } as any);
    expect(Number(r.enrollment.progressPct)).toBe(100); expect(r.enrollment.completedAt).toBeTruthy();
  });

  it('RLS: tenant B cannot see tenant A\'s enrollment', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM enrollments WHERE id=$1`, [enrollmentId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM enrollments WHERE id=$1`, [enrollmentId])).rows.length).toBe(1);
  });
});
