// modules/education/repositories/enrollment.repository.ts · enrollments. tenant_id in every query (Law 1) + RLS.
// UNIQUE(course_id, learner_user_id) makes enroll idempotent at the DB. No version → mutations lock FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Enrollment } from '../domain/enrollment.entity';

const COLS = `id, tenant_id, course_id, learner_user_id, payment_id, progress_pct, completed_at, certificate_media_id, created_at`;
function toDomain(r: any): Enrollment {
  return Enrollment.rehydrate({ id: r.id, tenantId: r.tenant_id, courseId: r.course_id, learnerUserId: r.learner_user_id, paymentId: r.payment_id,
    progressPct: Number(r.progress_pct), completedAt: r.completed_at, certificateMediaId: r.certificate_media_id, createdAt: r.created_at });
}
export interface EnrollmentListQuery { completedOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class EnrollmentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, e: Enrollment): Promise<void> {
    const p = e.toProps();
    await tx.query(`INSERT INTO enrollments (id, tenant_id, course_id, learner_user_id, payment_id, progress_pct, created_by) VALUES ($1,$2,$3,$4,$5,$6,$4)`,
      [p.id, p.tenantId, p.courseId, p.learnerUserId, p.paymentId, p.progressPct]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Enrollment | null> {
    const r = await tx.query(`SELECT ${COLS} FROM enrollments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async findByCourseLearner(tenantId: string, courseId: string, learnerUserId: string, tx?: TxContext): Promise<Enrollment | null> {
    const sql = `SELECT ${COLS} FROM enrollments WHERE course_id=$1 AND learner_user_id=$2 AND tenant_id=$3 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [courseId, learnerUserId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [courseId, learnerUserId, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getByIdForLearner(tenantId: string, learnerUserId: string, id: string): Promise<Enrollment | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM enrollments WHERE id=$1 AND tenant_id=$2 AND learner_user_id=$3 AND deleted_at IS NULL`, [id, tenantId, learnerUserId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, e: Enrollment): Promise<void> {
    const p = e.toProps();
    await tx.query(`UPDATE enrollments SET progress_pct=$3, completed_at=$4, certificate_media_id=$5, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.progressPct, p.completedAt, p.certificateMediaId]);
  }
  async listForLearner(tenantId: string, learnerUserId: string, q: EnrollmentListQuery): Promise<Enrollment[]> {
    const params: unknown[] = [tenantId, learnerUserId]; let where = `tenant_id=$1 AND learner_user_id=$2 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.completedOnly) where += ` AND completed_at IS NOT NULL`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM enrollments WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
