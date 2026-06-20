// modules/support/jobs/sla-breach-escalation.job.ts · the worker's SLA-breach escalation runner.
// Connected as the BYPASSRLS relay role, it finds working tickets past their resolution-SLA that aren't yet
// escalated and escalates each via SupportTicketService.escalateOverdue (idempotent, in-tenant tx). One ticket's
// failure never aborts the batch. Bounded by `max` per run.
import type { Pool } from 'pg';
import { SupportTicketService } from '../services/support-ticket.service';

export interface SlaBatchResult { scanned: number; escalated: number; failed: number; }

export async function runSlaBreachEscalation(relayPool: Pool, service: SupportTicketService, max = 500): Promise<SlaBatchResult> {
  const r = await relayPool.query(
    `SELECT tenant_id, id FROM support_tickets
      WHERE status NOT IN ('resolved','closed','escalated') AND deleted_at IS NULL
        AND sla_resolution_due IS NOT NULL AND sla_resolution_due < now()
      ORDER BY sla_resolution_due LIMIT $1`, [max]);
  const result: SlaBatchResult = { scanned: r.rows.length, escalated: 0, failed: 0 };
  for (const row of r.rows) {
    try { if (await service.escalateOverdue(row.tenant_id, row.id)) result.escalated++; }
    catch { result.failed++; }
  }
  return result;
}
