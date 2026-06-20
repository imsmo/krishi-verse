// modules/education/repositories/course.repository.ts · courses. tenant_id in every tenant query (Law 1) + RLS
// (NULL tenant = platform library, visible to all). No version → mutations lock FOR UPDATE. Keyset browse.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Course } from '../domain/course.entity';
import { CourseStatus, CourseLevel } from '../domain/education.events';

const COLS = `id, tenant_id, instructor_id, default_title, topic_id, audience_role_ids, level, price_minor, currency_code, cert_enabled, cover_media_id, status, created_at`;
function toDomain(r: any): Course {
  return Course.rehydrate({ id: r.id, tenantId: r.tenant_id, instructorId: r.instructor_id, defaultTitle: r.default_title, topicId: r.topic_id,
    audienceRoleIds: (r.audience_role_ids ?? []) as string[], level: r.level as CourseLevel, priceMinor: BigInt(r.price_minor), currencyCode: r.currency_code,
    certEnabled: r.cert_enabled, coverMediaId: r.cover_media_id, status: r.status as CourseStatus, createdAt: r.created_at });
}
export interface CourseListQuery { box: 'browse' | 'mine' | 'all'; instructorId?: string; topicId?: string; level?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class CourseRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, c: Course, tenantId: string | null, createdBy: string): Promise<void> {
    const p = c.toProps();
    await tx.query(
      `INSERT INTO courses (id, tenant_id, instructor_id, default_title, topic_id, audience_role_ids, level, price_minor, currency_code, cert_enabled, cover_media_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)`,
      [p.id, tenantId, p.instructorId, p.defaultTitle, p.topicId, JSON.stringify(p.audienceRoleIds), p.level, p.priceMinor.toString(), p.currencyCode, p.certEnabled, p.coverMediaId, p.status, createdBy]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Course | null> {
    const r = await tx.query(`SELECT ${COLS} FROM courses WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<Course | null> {
    const sql = `SELECT ${COLS} FROM courses WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, c: Course, tenantId: string): Promise<void> {
    const p = c.toProps();
    await tx.query(`UPDATE courses SET default_title=$3, topic_id=$4, audience_role_ids=$5::jsonb, level=$6, price_minor=$7, cert_enabled=$8, cover_media_id=$9, status=$10, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, tenantId, p.defaultTitle, p.topicId, JSON.stringify(p.audienceRoleIds), p.level, p.priceMinor.toString(), p.certEnabled, p.coverMediaId, p.status]);
  }
  async listFor(tenantId: string, q: CourseListQuery): Promise<Course[]> {
    const params: unknown[] = [tenantId]; let where = `(tenant_id=$1 OR tenant_id IS NULL) AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'browse') where += ` AND status='published'`;
    if (q.box === 'mine' && q.instructorId) where += ` AND instructor_id=${p(q.instructorId)}`;
    if (q.topicId) where += ` AND topic_id=${p(q.topicId)}`;
    if (q.level) where += ` AND level=${p(q.level)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM courses WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
