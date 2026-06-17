// core/outbox/outbox.dispatcher.ts
// The transactional-outbox RELAY (Law 4: events flow ONLY through the outbox). Turns same-tx
// outbox rows into cross-module handler calls, in order, exactly-once-ish:
//   • claims ONE pending event at a time with FOR UPDATE SKIP LOCKED (many relay workers are safe);
//   • sets app.tenant_id to the event's tenant, then runs every registered handler for its type
//     INSIDE the same tx (handler writes + marking the event 'published' commit atomically);
//   • a handler throwing rolls the tx back and marks the event 'failed' (a DLQ/requeue job retries);
//   • handlers MUST be idempotent (at-least-once delivery).
// Runs on a privileged connection (kv_relay, BYPASSRLS — see migration 0018) so it can see every
// tenant's pending events; the request tier (kv_app) is RLS-scoped and never relays.
import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { Metrics } from '../observability/metrics';
import { TxContext } from '../database/unit-of-work';
import { OutboxEvent, OutboxHandler } from './event-envelope';

/** Registry of consumers, keyed by event_type. Modules register their handlers at init. */
@Injectable()
export class OutboxHandlerRegistry {
  private readonly byType = new Map<string, OutboxHandler[]>();
  register(handler: OutboxHandler): void {
    const list = this.byType.get(handler.eventType) ?? [];
    list.push(handler);
    this.byType.set(handler.eventType, list);
  }
  handlersFor(eventType: string): OutboxHandler[] { return this.byType.get(eventType) ?? []; }
  get size(): number { return this.byType.size; }
}

export class OutboxDispatcher {
  constructor(private readonly relayPool: Pool, private readonly registry: OutboxHandlerRegistry, private readonly metrics: Metrics) {}

  /** Relay up to `max` pending events. Returns how many were processed (published or failed). */
  async relayBatch(max = 100): Promise<number> {
    let n = 0;
    for (let i = 0; i < max; i++) {
      const processed = await this.relayOne();
      if (!processed) break;     // queue drained
      n++;
    }
    return n;
  }

  /** Process exactly one pending event in its own transaction. Returns false when none remain. */
  async relayOne(): Promise<boolean> {
    const client = await this.relayPool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `SELECT id, tenant_id, aggregate_type, aggregate_id, event_type, payload
           FROM outbox_events WHERE status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`);
      if (r.rowCount === 0) { await client.query('ROLLBACK'); return false; }
      const row = r.rows[0];
      const event: OutboxEvent = { id: String(row.id), tenantId: row.tenant_id, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, eventType: row.event_type, payload: row.payload };

      try {
        // tenant context for any current_tenant_id() usage inside handlers (defense-in-depth)
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [event.tenantId ?? '']);
        const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: event.tenantId ?? '', userId: 'system' };
        for (const h of this.registry.handlersFor(event.eventType)) await h.handle(event, tx);
        await client.query(`UPDATE outbox_events SET status='published', published_at=now() WHERE id=$1`, [row.id]);
        await client.query('COMMIT');
        this.metrics.inc('outbox.published', { type: event.eventType });
        return true;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        // mark failed in a fresh statement (the event tx rolled back); DLQ/requeue handles it
        await this.relayPool.query(`UPDATE outbox_events SET status='failed' WHERE id=$1`, [row.id]).catch(() => undefined);
        this.metrics.inc('outbox.failed', { type: event.eventType });
        return true;   // we did process (and quarantined) one event
      }
    } finally {
      client.release();
    }
  }
}
