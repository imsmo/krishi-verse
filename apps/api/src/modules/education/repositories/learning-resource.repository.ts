// modules/education/repositories/learning-resource.repository.ts · learning_resources. tenant_id in every query
// (Law 1) + RLS. No version → moderation locks FOR UPDATE. Keyset lists; browse = approved only.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LearningResource } from '../domain/learning-resource.entity';
import { ResourceKind, ResourceStatus } from '../domain/creator.events';

const COLS = `id, tenant_id, channel_id, owner_user_id, kind, title, external_url, media_id, topic_id, language_code, body, status, reviewed_by, reviewed_at, created_at`;
function toDomain(r: any): LearningResource {
  return LearningResource.rehydrate({ id: r.id, tenantId: r.tenant_id, channelId: r.channel_id, ownerUserId: r.owner_user_id, kind: r.kind as ResourceKind, title: r.title,
    externalUrl: r.external_url, mediaId: r.media_id, topicId: r.topic_id, languageCode: r.language_code, body: r.body, status: r.status as ResourceStatus,
    reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, createdAt: r.created_at });
}
export interface ResourceListQuery { box: 'browse' | 'mine' | 'all'; ownerUserId?: string; channelId?: string; kind?: string; topicId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class LearningResourceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, r: LearningResource): Promise<void> {
    const p = r.toProps();
    await tx.query(`INSERT INTO learning_resources (id, tenant_id, channel_id, owner_user_id, kind, title, external_url, media_id, topic_id, language_code, body, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$4)`,
      [p.id, p.tenantId, p.channelId, p.ownerUserId, p.kind, p.title, p.externalUrl, p.mediaId, p.topicId, p.languageCode, p.body, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<LearningResource | null> {
    const r = await tx.query(`SELECT ${COLS} FROM learning_resources WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, r: LearningResource): Promise<void> {
    const p = r.toProps();
    await tx.query(`UPDATE learning_resources SET title=$3, status=$4, reviewed_by=$5, reviewed_at=$6, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.title, p.status, p.reviewedBy, p.reviewedAt]);
  }
  async listFor(tenantId: string, q: ResourceListQuery): Promise<LearningResource[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'browse') where += ` AND status='approved'`;
    if (q.box === 'mine' && q.ownerUserId) where += ` AND owner_user_id=${p(q.ownerUserId)}`;
    if (q.channelId) where += ` AND channel_id=${p(q.channelId)}`;
    if (q.kind) where += ` AND kind=${p(q.kind)}`;
    if (q.topicId) where += ` AND topic_id=${p(q.topicId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM learning_resources WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Resolve topic_id → lookup_values.default_name for a BOUNDED set of ids (the current page). Closes the §13
   *  "topicId but no name" gap on the tips screens. Unknown ids simply don't appear (degrade, never fabricate). */
  async topicNames(tenantId: string, ids: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return {};
    const r = await this.replica.forTenant(tenantId).query<{ id: string; default_name: string }>(
      `SELECT id, default_name FROM lookup_values WHERE id = ANY($1)`, [unique]);
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.id] = row.default_name;
    return out;
  }
}
