// modules/communication/repositories/broadcast.repository.ts · all SQL for tenant_broadcasts (+ recipient resolve).
// tenant_id in EVERY query (Law 1) + RLS. Reads on the replica; lists are KEYSET. Recipient resolution is
// BATCHED + keyset over user_tenant_roles (Law 8 — an audience of millions is fanned out a page at a time,
// never loaded whole). Always scoped to the broadcast's tenant.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Broadcast } from '../domain/broadcast.entity';
import { BroadcastStatus } from '../domain/broadcast.state';

const COLS = `id, tenant_id, created_by_user_id, audience_role_code, title, body, status, recipient_count, sent_count, failure_reason, created_at`;
function toDomain(r: any): Broadcast {
  return Broadcast.rehydrate({
    id: r.id, tenantId: r.tenant_id, createdByUserId: r.created_by_user_id, audienceRoleCode: r.audience_role_code,
    title: r.title, body: r.body, status: r.status as BroadcastStatus, recipientCount: r.recipient_count,
    sentCount: r.sent_count, failureReason: r.failure_reason, createdAt: r.created_at,
  });
}
export interface BroadcastListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class BroadcastRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, b: Broadcast): Promise<void> {
    const p = b.toProps();
    await tx.query(
      `INSERT INTO tenant_broadcasts (id, tenant_id, created_by_user_id, audience_role_code, title, body, status, recipient_count, sent_count, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$3)`,
      [p.id, p.tenantId, p.createdByUserId, p.audienceRoleCode, p.title, p.body, p.status, p.recipientCount, p.sentCount]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Broadcast | null> {
    const r = await tx.query(`SELECT ${COLS} FROM tenant_broadcasts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, b: Broadcast): Promise<void> {
    const p = b.toProps();
    await tx.query(
      `UPDATE tenant_broadcasts SET status=$3, recipient_count=$4, sent_count=$5, failure_reason=$6, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.recipientCount, p.sentCount, p.failureReason]);
  }
  async listForTenant(tenantId: string, q: BroadcastListQuery): Promise<Broadcast[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM tenant_broadcasts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** One KEYSET page of recipient user-ids for the audience (all active members, or one role). `afterUserId`
   *  drives the cursor; the fan-out walks pages until empty so an audience of any size stays bounded per call. */
  async recipientPage(tx: TxContext, tenantId: string, audienceRoleCode: string | null, afterUserId: string | null, limit: number): Promise<string[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `utr.tenant_id=$1 AND utr.is_active=true AND utr.deleted_at IS NULL`;
    let join = '';
    if (audienceRoleCode) { join = `JOIN roles r ON r.id = utr.role_id`; where += ` AND r.code=${p(audienceRoleCode)}`; }
    if (afterUserId) where += ` AND utr.user_id > ${p(afterUserId)}`;
    const lp = p(limit);
    const r = await tx.query<{ user_id: string }>(
      `SELECT DISTINCT utr.user_id FROM user_tenant_roles utr ${join} WHERE ${where} ORDER BY utr.user_id LIMIT ${lp}`, params);
    return r.rows.map((x) => x.user_id);
  }
}
