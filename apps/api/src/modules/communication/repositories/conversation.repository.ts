// modules/communication/repositories/conversation.repository.ts · conversations + conversation_participants.
// tenant_id binds every conversations query (Law 1) + RLS. conversation_participants has NO tenant_id, so it is
// ALWAYS joined to conversations on tenant_id (membership can't leak across tenants). No version → lock toggles
// use FOR UPDATE. Membership is the access gate: a non-participant read returns null → the service 404s (no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Conversation } from '../domain/conversation.entity';
import { ContextType, ParticipantRole } from '../domain/messaging.events';

const COLS = `id, tenant_id, context_type, context_id, is_locked, created_at`;
function toDomain(r: any): Conversation {
  return Conversation.rehydrate({ id: r.id, tenantId: r.tenant_id, contextType: r.context_type as ContextType, contextId: r.context_id, isLocked: r.is_locked, createdAt: r.created_at });
}
export interface ConversationListQuery { contextType?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ConversationRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, c: Conversation): Promise<void> {
    const p = c.toProps();
    await tx.query(`INSERT INTO conversations (id, tenant_id, context_type, context_id, is_locked, created_by) VALUES ($1,$2,$3,$4,$5,NULL)`,
      [p.id, p.tenantId, p.contextType, p.contextId, p.isLocked]);
  }
  async addParticipants(tx: TxContext, conversationId: string, participants: { userId: string; role: ParticipantRole }[]): Promise<void> {
    for (const it of participants) {
      await tx.query(`INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (conversation_id, user_id) DO NOTHING`, [conversationId, it.userId, it.role]);
    }
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Conversation | null> {
    const r = await tx.query(`SELECT ${COLS} FROM conversations WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** True only if the user is a participant of a conversation in this tenant (the access gate). */
  async isParticipant(tenantId: string, conversationId: string, userId: string, tx?: TxContext): Promise<boolean> {
    const sql = `SELECT 1 FROM conversation_participants cp JOIN conversations c ON c.id=cp.conversation_id
                 WHERE cp.conversation_id=$1 AND cp.user_id=$2 AND c.tenant_id=$3 AND c.deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [conversationId, userId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [conversationId, userId, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }
  /** A conversation visible to the user (participant only). null ⇒ the service 404s (anti-IDOR). */
  async getForParticipant(tenantId: string, userId: string, id: string): Promise<Conversation | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS.split(', ').map((c) => 'c.' + c).join(', ')} FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id
       WHERE c.id=$1 AND c.tenant_id=$2 AND cp.user_id=$3 AND c.deleted_at IS NULL`, [id, tenantId, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** A single open conversation already attached to a context (idempotent open). */
  async findByContext(tenantId: string, contextType: string, contextId: string, tx?: TxContext): Promise<Conversation | null> {
    const sql = `SELECT ${COLS} FROM conversations WHERE tenant_id=$1 AND context_type=$2 AND context_id=$3 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`;
    const r = tx ? await tx.query(sql, [tenantId, contextType, contextId]) : await this.replica.forTenant(tenantId).query(sql, [tenantId, contextType, contextId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async participantIds(tenantId: string, conversationId: string, tx?: TxContext): Promise<string[]> {
    const sql = `SELECT cp.user_id FROM conversation_participants cp JOIN conversations c ON c.id=cp.conversation_id WHERE cp.conversation_id=$1 AND c.tenant_id=$2`;
    const r = tx ? await tx.query(sql, [conversationId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [conversationId, tenantId]);
    return r.rows.map((x: any) => x.user_id);
  }
  /** The user's role in a conversation (or null if not a participant). Tenant-joined (no cross-tenant leak). */
  async participantRole(tenantId: string, conversationId: string, userId: string, tx?: TxContext): Promise<string | null> {
    const sql = `SELECT cp.role FROM conversation_participants cp JOIN conversations c ON c.id=cp.conversation_id
                 WHERE cp.conversation_id=$1 AND cp.user_id=$2 AND c.tenant_id=$3 AND c.deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [conversationId, userId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [conversationId, userId, tenantId]);
    return r.rows[0]?.role ?? null;
  }
  async markRead(tx: TxContext, conversationId: string, userId: string): Promise<void> {
    await tx.query(`UPDATE conversation_participants SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2`, [conversationId, userId]);
  }
  async update(tx: TxContext, c: Conversation): Promise<void> {
    const p = c.toProps();
    await tx.query(`UPDATE conversations SET is_locked=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.isLocked]);
  }
  /** The caller's conversations (participant), keyset (never OFFSET). */
  async listForUser(tenantId: string, userId: string, q: ConversationListQuery): Promise<Conversation[]> {
    const params: unknown[] = [tenantId, userId]; let where = `c.tenant_id=$1 AND cp.user_id=$2 AND c.deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.contextType) where += ` AND c.context_type=${p(q.contextType)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (c.created_at < ${cc} OR (c.created_at=${cc} AND c.id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS.split(', ').map((c) => 'c.' + c).join(', ')} FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id
       WHERE ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
