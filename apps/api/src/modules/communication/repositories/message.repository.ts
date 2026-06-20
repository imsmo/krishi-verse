// modules/communication/repositories/message.repository.ts · messages (append-only, PARTITIONED by created_at).
// tenant_id in every query (Law 1) + RLS. Lists are KEYSET on (created_at,id) DESC — never OFFSET — backed by
// idx_messages_conv. is_flagged is the only mutable field (moderation); its update binds (id, created_at) so PG
// prunes to one partition (Law 8). Membership is enforced by the service BEFORE these run.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Message } from '../domain/message.entity';

const COLS = `id, conversation_id, tenant_id, sender_user_id, body, voice_media_id, attachment_media_id, is_ai_generated, is_flagged, created_at`;
function toDomain(r: any): Message {
  return Message.rehydrate({ id: r.id, conversationId: r.conversation_id, tenantId: r.tenant_id, senderUserId: r.sender_user_id, body: r.body,
    voiceMediaId: r.voice_media_id, attachmentMediaId: r.attachment_media_id, isAiGenerated: r.is_ai_generated, isFlagged: r.is_flagged, createdAt: r.created_at });
}
export interface MessageListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class MessageRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, m: Message): Promise<void> {
    const p = m.toProps();
    await tx.query(
      `INSERT INTO messages (id, conversation_id, tenant_id, sender_user_id, body, voice_media_id, attachment_media_id, is_ai_generated, is_flagged)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.conversationId, p.tenantId, p.senderUserId, p.body, p.voiceMediaId, p.attachmentMediaId, p.isAiGenerated, p.isFlagged]);
  }
  async listForConversation(tenantId: string, conversationId: string, q: MessageListQuery): Promise<Message[]> {
    const params: unknown[] = [tenantId, conversationId]; let where = `tenant_id=$1 AND conversation_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM messages WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Message | null> {
    const r = await tx.query(`SELECT ${COLS} FROM messages WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, m: Message): Promise<void> {
    const p = m.toProps();
    await tx.query(`UPDATE messages SET is_flagged=$3 WHERE id=$1 AND created_at=$2`, [p.id, p.createdAt, p.isFlagged]);
  }
}
