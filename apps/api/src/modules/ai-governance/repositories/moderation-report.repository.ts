// modules/ai-governance/repositories/moderation-report.repository.ts · moderation_reports (tenant-scoped, uuid
// PK). tenant_id in every query (Law 1) + RLS. No version column → handle() locks the row FOR UPDATE. The
// insert relies on the partial UNIQUE index (uq_modreport_one_per_reporter, migration 0029) — ON CONFLICT DO
// NOTHING makes a user's duplicate report on the same subject a no-op (abuse guard, §4). reason_id is resolved
// from the 'report_reason' lookup vocabulary. Lists are KEYSET (never OFFSET).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ModerationReport } from '../domain/moderation-report.entity';
import { ModerationStatus, ModerationAction } from '../domain/ai-governance.events';

const COLS = `id, tenant_id, reporter_user_id, subject_type, subject_id, reason_id, details, status, action_taken, handled_by, handled_at, created_at`;
function toDomain(r: any): ModerationReport {
  return ModerationReport.rehydrate({ id: r.id, tenantId: r.tenant_id, reporterUserId: r.reporter_user_id, subjectType: r.subject_type,
    subjectId: r.subject_id, reasonId: r.reason_id, details: r.details, status: r.status as ModerationStatus,
    actionTaken: r.action_taken as ModerationAction | null, handledBy: r.handled_by, handledAt: r.handled_at, createdAt: r.created_at });
}
export interface ReportListQuery { box: 'open' | 'all'; subjectType?: string; subjectId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ModerationReportRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Resolve a 'report_reason' lookup code → id (NULL tenant = platform vocab). */
  async resolveReasonId(tx: TxContext, code: string): Promise<string | null> {
    const r = await tx.query(`SELECT id FROM lookup_values WHERE type_code='report_reason' AND code=$1 AND tenant_id IS NULL LIMIT 1`, [code]);
    return r.rows[0]?.id ?? null;
  }
  /** Insert; returns false if the reporter already has a live report on this subject (dedup no-op). */
  async insertDeduped(tx: TxContext, r: ModerationReport): Promise<boolean> {
    const p = r.toProps();
    const res = await tx.query(
      `INSERT INTO moderation_reports (id, tenant_id, reporter_user_id, subject_type, subject_id, reason_id, details, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$3)
       ON CONFLICT (tenant_id, subject_type, subject_id, reporter_user_id) WHERE reporter_user_id IS NOT NULL AND deleted_at IS NULL DO NOTHING`,
      [p.id, p.tenantId, p.reporterUserId, p.subjectType, p.subjectId, p.reasonId, p.details, p.status]);
    return (res.rowCount ?? 0) > 0;
  }
  /** How many OPEN reports stand against this subject (first-report detection / moderator signal). */
  async countOpenForSubject(tx: TxContext, tenantId: string, subjectType: string, subjectId: string): Promise<number> {
    const r = await tx.query(`SELECT count(*)::int AS n FROM moderation_reports WHERE tenant_id=$1 AND subject_type=$2 AND subject_id=$3 AND status='open'`, [tenantId, subjectType, subjectId]);
    return r.rows[0]?.n ?? 0;
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ModerationReport | null> {
    const r = await tx.query(`SELECT ${COLS} FROM moderation_reports WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<ModerationReport | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM moderation_reports WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, r: ModerationReport): Promise<void> {
    const p = r.toProps();
    await tx.query(`UPDATE moderation_reports SET status=$3, action_taken=$4, handled_by=$5, handled_at=$6, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.actionTaken, p.handledBy, p.handledAt]);
  }
  async listFor(tenantId: string, q: ReportListQuery): Promise<ModerationReport[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'open') where += ` AND status='open'`;
    if (q.subjectType) where += ` AND subject_type=${p(q.subjectType)}`;
    if (q.subjectId) where += ` AND subject_id=${p(q.subjectId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM moderation_reports WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
