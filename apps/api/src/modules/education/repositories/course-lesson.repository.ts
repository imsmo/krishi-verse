// modules/education/repositories/course-lesson.repository.ts · course_lessons. Scoped through the course (which
// is tenant-scoped + RLS). Ordered by (module_no, lesson_no). Upsert on the UNIQUE(course_id,module_no,lesson_no).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CourseLesson } from '../domain/course-lesson.entity';
import { ContentKind } from '../domain/education.events';

const COLS = `id, course_id, module_no, lesson_no, default_title, content_kind, media_id, body, duration_secs, quiz, created_at`;
function toDomain(r: any): CourseLesson {
  return CourseLesson.rehydrate({ id: r.id, courseId: r.course_id, moduleNo: r.module_no, lessonNo: r.lesson_no, defaultTitle: r.default_title,
    contentKind: r.content_kind as ContentKind, mediaId: r.media_id, body: r.body, durationSecs: r.duration_secs, quiz: r.quiz, createdAt: r.created_at });
}
@Injectable()
export class CourseLessonRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async upsert(tx: TxContext, l: CourseLesson, createdBy: string): Promise<void> {
    const p = l.toProps();
    await tx.query(
      `INSERT INTO course_lessons (id, course_id, module_no, lesson_no, default_title, content_kind, media_id, body, duration_secs, quiz, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       ON CONFLICT (course_id, module_no, lesson_no) DO UPDATE SET default_title=EXCLUDED.default_title, content_kind=EXCLUDED.content_kind, media_id=EXCLUDED.media_id, body=EXCLUDED.body, duration_secs=EXCLUDED.duration_secs, quiz=EXCLUDED.quiz, updated_at=now()`,
      [p.id, p.courseId, p.moduleNo, p.lessonNo, p.defaultTitle, p.contentKind, p.mediaId, p.body, p.durationSecs, p.quiz === undefined ? null : JSON.stringify(p.quiz), createdBy]);
  }
  async listForCourse(tenantId: string, courseId: string, tx?: TxContext): Promise<CourseLesson[]> {
    // tenant-gated through the course join (course_lessons has no tenant_id of its own)
    const sql = `SELECT ${COLS.split(', ').map((c) => 'l.' + c).join(', ')} FROM course_lessons l JOIN courses c ON c.id=l.course_id
       WHERE l.course_id=$1 AND (c.tenant_id=$2 OR c.tenant_id IS NULL) AND c.deleted_at IS NULL ORDER BY l.module_no, l.lesson_no`;
    const r = tx ? await tx.query(sql, [courseId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [courseId, tenantId]);
    return r.rows.map(toDomain);
  }
  async countForCourse(tenantId: string, courseId: string, tx: TxContext): Promise<number> {
    const r = await tx.query(`SELECT count(*)::int n FROM course_lessons l JOIN courses c ON c.id=l.course_id WHERE l.course_id=$1 AND (c.tenant_id=$2 OR c.tenant_id IS NULL)`, [courseId, tenantId]);
    return r.rows[0]?.n ?? 0;
  }
}
