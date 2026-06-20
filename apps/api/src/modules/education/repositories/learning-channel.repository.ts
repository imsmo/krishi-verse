// modules/education/repositories/learning-channel.repository.ts · learning_channels. tenant_id in every query
// (Law 1) + RLS. No version → moderation locks FOR UPDATE. Keyset lists; browse = approved only.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LearningChannel } from '../domain/learning-channel.entity';
import { ChannelProvider, ChannelStatus } from '../domain/creator.events';

const COLS = `id, tenant_id, owner_user_id, provider, title, handle, external_url, topic_id, description, status, review_note, reviewed_by, reviewed_at, created_at`;
function toDomain(r: any): LearningChannel {
  return LearningChannel.rehydrate({ id: r.id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id, provider: r.provider as ChannelProvider, title: r.title,
    handle: r.handle, externalUrl: r.external_url, topicId: r.topic_id, description: r.description, status: r.status as ChannelStatus,
    reviewNote: r.review_note, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, createdAt: r.created_at });
}
export interface ChannelListQuery { box: 'browse' | 'mine' | 'all'; ownerUserId?: string; status?: string; topicId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class LearningChannelRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, c: LearningChannel): Promise<void> {
    const p = c.toProps();
    await tx.query(`INSERT INTO learning_channels (id, tenant_id, owner_user_id, provider, title, handle, external_url, topic_id, description, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$3)`,
      [p.id, p.tenantId, p.ownerUserId, p.provider, p.title, p.handle, p.externalUrl, p.topicId, p.description, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<LearningChannel | null> {
    const r = await tx.query(`SELECT ${COLS} FROM learning_channels WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<LearningChannel | null> {
    const sql = `SELECT ${COLS} FROM learning_channels WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, c: LearningChannel): Promise<void> {
    const p = c.toProps();
    await tx.query(`UPDATE learning_channels SET title=$3, handle=$4, description=$5, topic_id=$6, status=$7, review_note=$8, reviewed_by=$9, reviewed_at=$10, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.title, p.handle, p.description, p.topicId, p.status, p.reviewNote, p.reviewedBy, p.reviewedAt]);
  }
  async listFor(tenantId: string, q: ChannelListQuery): Promise<LearningChannel[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'browse') where += ` AND status='approved'`;
    if (q.box === 'mine' && q.ownerUserId) where += ` AND owner_user_id=${p(q.ownerUserId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.topicId) where += ` AND topic_id=${p(q.topicId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM learning_channels WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
