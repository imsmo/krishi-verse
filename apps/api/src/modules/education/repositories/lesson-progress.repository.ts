// modules/education/repositories/lesson-progress.repository.ts · lesson_progress (PK enrollment_id+lesson_id).
// Scoped through the enrollment (tenant-scoped + RLS). Upsert is idempotent; count(distinct completed) drives
// the enrollment's progress_pct recompute.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LessonProgress } from '../domain/lesson-progress.entity';

@Injectable()
export class LessonProgressRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async upsert(tx: TxContext, lp: LessonProgress): Promise<void> {
    const p = lp.toProps();
    await tx.query(
      `INSERT INTO lesson_progress (enrollment_id, lesson_id, completed_at, seconds_watched, quiz_score) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
         completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
         seconds_watched = GREATEST(lesson_progress.seconds_watched, EXCLUDED.seconds_watched),
         quiz_score = COALESCE(EXCLUDED.quiz_score, lesson_progress.quiz_score)`,
      [p.enrollmentId, p.lessonId, p.completedAt, p.secondsWatched, p.quizScore]);
  }
  async countCompleted(tx: TxContext, enrollmentId: string): Promise<number> {
    const r = await tx.query(`SELECT count(*)::int n FROM lesson_progress WHERE enrollment_id=$1 AND completed_at IS NOT NULL`, [enrollmentId]);
    return r.rows[0]?.n ?? 0;
  }
  async listForEnrollment(tenantId: string, enrollmentId: string): Promise<LessonProgress[]> {
    // gated via the enrollment join (lesson_progress has no tenant_id)
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT lp.enrollment_id, lp.lesson_id, lp.completed_at, lp.seconds_watched, lp.quiz_score
         FROM lesson_progress lp JOIN enrollments e ON e.id=lp.enrollment_id
        WHERE lp.enrollment_id=$1 AND e.tenant_id=$2`, [enrollmentId, tenantId]);
    return r.rows.map((x: any) => LessonProgress.rehydrate({ enrollmentId: x.enrollment_id, lessonId: x.lesson_id, completedAt: x.completed_at, secondsWatched: x.seconds_watched, quizScore: x.quiz_score === null ? null : Number(x.quiz_score) }));
  }
}
