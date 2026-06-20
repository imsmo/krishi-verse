// modules/traceability/repositories/trace-event.repository.ts · trace_events (PARTITIONED by created_at,
// append-only). tenant_id in every query (Law 1) + RLS. lastHash backs the tamper-evident chain; the timeline
// list is KEYSET on (created_at, id) ASC — never OFFSET — backed by idx_trace_events_lot.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { TraceEvent } from '../domain/trace-event.entity';
import { TraceStep } from '../domain/traceability.events';

const COLS = `id, trace_lot_id, tenant_id, event_code, meta, event_hash, created_at`;
function toDomain(r: any): TraceEvent {
  return TraceEvent.rehydrate({ id: String(r.id), traceLotId: r.trace_lot_id, tenantId: r.tenant_id, eventCode: r.event_code as TraceStep, meta: r.meta ?? {}, eventHash: r.event_hash, createdAt: r.created_at });
}
export interface EventListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class TraceEventRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, e: TraceEvent): Promise<void> {
    const p = e.toProps();
    await tx.query(`INSERT INTO trace_events (trace_lot_id, tenant_id, event_code, meta, event_hash) VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [p.traceLotId, p.tenantId, p.eventCode, JSON.stringify(p.meta), p.eventHash]);
  }
  /** Latest event hash for a lot (the chain head). null if no events yet. Read in-tx for a consistent chain. */
  async lastHash(tx: TxContext, tenantId: string, traceLotId: string): Promise<string | null> {
    const r = await tx.query(`SELECT event_hash FROM trace_events WHERE tenant_id=$1 AND trace_lot_id=$2 ORDER BY created_at DESC, id DESC LIMIT 1`, [tenantId, traceLotId]);
    return r.rows[0]?.event_hash ?? null;
  }
  /** Has a given event_code already been recorded for this lot? (idempotency guard for auto-fanout). */
  async hasCode(tx: TxContext, tenantId: string, traceLotId: string, eventCode: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM trace_events WHERE tenant_id=$1 AND trace_lot_id=$2 AND event_code=$3 LIMIT 1`, [tenantId, traceLotId, eventCode]);
    return (r.rowCount ?? 0) > 0;
  }
  async listForLot(tenantId: string, traceLotId: string, q: EventListQuery): Promise<TraceEvent[]> {
    const params: unknown[] = [tenantId, traceLotId]; let where = `tenant_id=$1 AND trace_lot_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at > ${cc} OR (created_at=${cc} AND id > ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM trace_events WHERE ${where} ORDER BY created_at ASC, id ASC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
