// modules/education/repositories/live-session.repository.ts · live_sessions + live_session_registrations.
// tenant_id in every session query (Law 1) + RLS. No version → lifecycle locks FOR UPDATE. Registrations have
// no tenant_id and are gated through the session join. Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LiveSession } from '../domain/live-session.entity';
import { LiveStatus } from '../domain/creator.events';

const COLS = `id, tenant_id, host_user_id, channel_id, title, topic_id, scheduled_at, status, provider_stream_ref, playback_url, recording_media_id, started_at, ended_at, created_at`;
function toDomain(r: any): LiveSession {
  return LiveSession.rehydrate({ id: r.id, tenantId: r.tenant_id, hostUserId: r.host_user_id, channelId: r.channel_id, title: r.title, topicId: r.topic_id,
    scheduledAt: r.scheduled_at, status: r.status as LiveStatus, providerStreamRef: r.provider_stream_ref, playbackUrl: r.playback_url,
    recordingMediaId: r.recording_media_id, startedAt: r.started_at, endedAt: r.ended_at, createdAt: r.created_at });
}
export interface LiveListQuery { box: 'upcoming' | 'mine' | 'all'; hostUserId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class LiveSessionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, s: LiveSession): Promise<void> {
    const p = s.toProps();
    await tx.query(`INSERT INTO live_sessions (id, tenant_id, host_user_id, channel_id, title, topic_id, scheduled_at, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$3)`,
      [p.id, p.tenantId, p.hostUserId, p.channelId, p.title, p.topicId, p.scheduledAt, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<LiveSession | null> {
    const r = await tx.query(`SELECT ${COLS} FROM live_sessions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<LiveSession | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM live_sessions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, s: LiveSession): Promise<void> {
    const p = s.toProps();
    await tx.query(`UPDATE live_sessions SET status=$3, provider_stream_ref=$4, playback_url=$5, recording_media_id=$6, started_at=$7, ended_at=$8, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.providerStreamRef, p.playbackUrl, p.recordingMediaId, p.startedAt, p.endedAt]);
  }
  async register(tx: TxContext, sessionId: string, userId: string): Promise<void> {
    await tx.query(`INSERT INTO live_session_registrations (session_id, user_id) VALUES ($1,$2) ON CONFLICT (session_id, user_id) DO NOTHING`, [sessionId, userId]);
  }
  async listFor(tenantId: string, q: LiveListQuery): Promise<LiveSession[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'upcoming') where += ` AND status IN ('scheduled','live')`;
    if (q.box === 'mine' && q.hostUserId) where += ` AND host_user_id=${p(q.hostUserId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM live_sessions WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
