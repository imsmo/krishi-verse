// modules/disputes/jobs/seller-response-timeout.job.ts
// Worker job (kv_relay): a respondent who never files their side shouldn't stall the buyer forever.
// Finds disputes still 'open' past their seller_respond_by deadline (across tenants) and moves them to
// 'under_review' so a moderator picks them up — emitting disputes.dispute_under_review (notifications
// fan out). open→under_review is a valid transition (dispute.state). Bounded per tick with
// FOR UPDATE SKIP LOCKED so concurrent workers never double-process; the status guard makes it
// idempotent (a moved dispute no longer matches). The status flip + outbox write commit in ONE tx
// (Law 4). NOT a DI provider — apps/worker instantiates it with the kv_relay pool.
import type { Pool, PoolClient } from 'pg';
import { DisputeEventType } from '../domain/disputes.events';

export class SellerResponseTimeoutJob {
  constructor(private readonly systemPool: Pool) {}

  async run(limit = 200): Promise<{ advanced: number }> {
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const claimed = await client.query<{ id: string; tenant_id: string; order_id: string }>(
        `UPDATE disputes SET status='under_review', updated_at=now()
          WHERE id IN (
            SELECT id FROM disputes
             WHERE status='open' AND seller_respond_by IS NOT NULL AND seller_respond_by < now()
             ORDER BY seller_respond_by ASC
             FOR UPDATE SKIP LOCKED LIMIT $1)
          RETURNING id, tenant_id, order_id`, [limit]);
      for (const d of claimed.rows) {
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'dispute',$2,$3,$4::jsonb)`,
          [d.tenant_id, d.id, DisputeEventType.UnderReview, JSON.stringify({ v: 1, disputeId: d.id, orderId: d.order_id, reason: 'seller_response_timeout' })]);
      }
      await client.query('COMMIT');
      return { advanced: claimed.rowCount ?? 0 };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
