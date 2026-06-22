// modules/disputes/jobs/sla-escalation.job.ts
// Worker job (kv_relay): a dispute the platform hasn't resolved by its sla_due_at must be ESCALATED
// (to a senior queue) rather than silently aging. Finds active, non-escalated disputes (open /
// seller_responded / under_review) past sla_due_at across tenants and moves them to 'escalated',
// emitting disputes.dispute_escalated. All three are valid →escalated transitions (dispute.state).
// Bounded with FOR UPDATE SKIP LOCKED (no double-process); the status guard makes it idempotent. The
// status flip + outbox write commit in ONE tx (Law 4). NOT a DI provider — apps/worker instantiates it.
import type { Pool, PoolClient } from 'pg';
import { DisputeEventType } from '../domain/disputes.events';

export class SlaEscalationJob {
  constructor(private readonly systemPool: Pool) {}

  async run(limit = 200): Promise<{ escalated: number }> {
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const claimed = await client.query<{ id: string; tenant_id: string; order_id: string }>(
        `UPDATE disputes SET status='escalated', updated_at=now()
          WHERE id IN (
            SELECT id FROM disputes
             WHERE status IN ('open','seller_responded','under_review')
               AND sla_due_at IS NOT NULL AND sla_due_at < now()
             ORDER BY sla_due_at ASC
             FOR UPDATE SKIP LOCKED LIMIT $1)
          RETURNING id, tenant_id, order_id`, [limit]);
      for (const d of claimed.rows) {
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'dispute',$2,$3,$4::jsonb)`,
          [d.tenant_id, d.id, DisputeEventType.Escalated, JSON.stringify({ v: 1, disputeId: d.id, orderId: d.order_id, reason: 'sla_breach' })]);
      }
      await client.query('COMMIT');
      return { escalated: claimed.rowCount ?? 0 };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
