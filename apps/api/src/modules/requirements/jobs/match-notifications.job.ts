// modules/requirements/jobs/match-notifications.job.ts
// Worker job (kv_relay): the periodic BACKSTOP to the event-driven listing-published handler. Live
// matching is fully event-driven (ListingPublishedHandler fires the moment a listing is published); a
// requirements-only sweep can't itself read the listings module (Law 11), so the job's self-contained,
// genuinely-useful role is to REMIND a buyer whose OPEN requirement is approaching its need_by and still
// hasn't been fulfilled — "your requirement is still open, sellers can still quote." Emits
// `requirements.requirement_reminder` (recipient = the buyer); communication delivers it.
// IDEMPOTENT + BOUNDED: claims only OPEN requirements within the need-by horizon that haven't been
// reminded (reminded_at IS NULL, FOR UPDATE SKIP LOCKED, LIMIT), emits one reminder each, then stamps
// reminded_at IN THE SAME tx — so a daily run never re-nudges (a §4 abuse/DoS guard). NOT a DI provider —
// apps/worker instantiates it with the kv_relay Pool + a RequirementRepository.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { RequirementRepository } from '../repositories/requirement.repository';
import { RequirementEventType } from '../domain/requirements.events';

export class MatchNotificationsJob {
  constructor(private readonly systemPool: Pool, private readonly requirements: RequirementRepository) {}

  /** `horizonDays` = nudge requirements whose need_by is within the next N days (default 3); `limit` caps
   *  the per-tick fan-out. Returns how many reminders were emitted. */
  async run(horizonDays = 3, limit = 200): Promise<{ scanned: number; reminded: number }> {
    const client = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const now = new Date();
      const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
      const due = await this.requirements.findDueForReminder(tx, now, horizon, limit);
      for (const r of due) {
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'requirement',$2,$3,$4::jsonb)`,
          [r.tenantId, r.id, RequirementEventType.ReminderDue,
           JSON.stringify({ v: 1, requirementId: r.id, buyerUserId: r.buyerUserId })]);
      }
      await this.requirements.markReminded(tx, due.map((d) => d.id));
      await client.query('COMMIT');
      return { scanned: due.length, reminded: due.length };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}
