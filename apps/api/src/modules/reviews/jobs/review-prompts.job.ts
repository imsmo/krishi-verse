// modules/reviews/jobs/review-prompts.job.ts
// Worker job (kv_relay): nudges the parties of a recently-COMPLETED order/service-booking to rate their
// counterparty. Both sides of a verified transaction may review (eligibility carries buyer + seller), so
// the prompt fans out to both via the `reviews.review_prompt` outbox event (communication delivers it).
// IDEMPOTENT + BOUNDED: claims only eligibility rows not yet prompted within the window (FOR UPDATE SKIP
// LOCKED, LIMIT), emits one prompt per row, then stamps prompted_at IN THE SAME tx — so a re-run never
// re-nudges (a §4 abuse/DoS guard). NOT a DI provider — apps/worker instantiates it with the kv_relay
// Pool + a ReviewRepository, mirroring the other expiry/sweep jobs. NO money, NO PII in the payload.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewEventType } from '../domain/reviews.events';

export class ReviewPromptsJob {
  constructor(private readonly systemPool: Pool, private readonly reviews: ReviewRepository) {}

  /** `windowMins` bounds the scan to orders/bookings completed recently (default 7d); `limit` caps the
   *  per-tick fan-out. Returns how many prompts were emitted. */
  async run(windowMins = 10080, limit = 200): Promise<{ scanned: number; prompted: number }> {
    const client = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const since = new Date(Date.now() - windowMins * 60_000);
      const due = await this.reviews.findDueForPrompt(tx, since, limit);
      for (const e of due) {
        // both parties may review the counterparty → recipientUserIds drives the notification fan-out
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'order',$2,$3,$4::jsonb)`,
          [e.tenantId, e.orderId, ReviewEventType.Prompt,
           JSON.stringify({ v: 1, orderId: e.orderId, recipientUserIds: [e.buyerUserId, e.sellerUserId] })]);
      }
      await this.reviews.markPrompted(tx, due.map((d) => d.id));
      await client.query('COMMIT');
      return { scanned: due.length, prompted: due.length };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}
