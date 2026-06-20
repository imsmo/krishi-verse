// modules/communication/repositories/masked-call.repository.ts · masked_calls privacy-proxy log (append-only,
// PARTITIONED by created_at). tenant_id in every query (Law 1) + RLS. The caller's own log = caller OR callee =
// userId. complete() binds (id, created_at) so PG prunes to one partition. NO raw phone numbers are ever stored.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MaskedCall } from '../domain/masked-call.entity';
import { ContextType } from '../domain/messaging.events';

const COLS = `id, tenant_id, caller_user_id, callee_user_id, context_type, context_id, provider_call_ref, duration_secs, recording_media_id, created_at`;
function toDomain(r: any): MaskedCall {
  return MaskedCall.rehydrate({ id: r.id, tenantId: r.tenant_id, callerUserId: r.caller_user_id, calleeUserId: r.callee_user_id,
    contextType: r.context_type as ContextType | null, contextId: r.context_id, providerCallRef: r.provider_call_ref, durationSecs: r.duration_secs, recordingMediaId: r.recording_media_id, createdAt: r.created_at });
}
export interface MaskedCallListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class MaskedCallRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, c: MaskedCall): Promise<void> {
    const p = c.toProps();
    await tx.query(
      `INSERT INTO masked_calls (id, tenant_id, caller_user_id, callee_user_id, context_type, context_id, provider_call_ref, duration_secs, recording_media_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.tenantId, p.callerUserId, p.calleeUserId, p.contextType, p.contextId, p.providerCallRef, p.durationSecs, p.recordingMediaId]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<MaskedCall | null> {
    const r = await tx.query(`SELECT ${COLS} FROM masked_calls WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getByProviderRef(tx: TxContext, providerCallRef: string): Promise<MaskedCall | null> {
    const r = await tx.query(`SELECT ${COLS} FROM masked_calls WHERE provider_call_ref=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [providerCallRef]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, c: MaskedCall): Promise<void> {
    const p = c.toProps();
    await tx.query(`UPDATE masked_calls SET duration_secs=$3, recording_media_id=$4 WHERE id=$1 AND created_at=$2`, [p.id, p.createdAt, p.durationSecs, p.recordingMediaId]);
  }
  /** The caller's own call log (caller OR callee), keyset (never OFFSET). */
  async listForUser(tenantId: string, userId: string, q: MaskedCallListQuery): Promise<MaskedCall[]> {
    const params: unknown[] = [tenantId, userId]; let where = `tenant_id=$1 AND (caller_user_id=$2 OR callee_user_id=$2)`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM masked_calls WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
