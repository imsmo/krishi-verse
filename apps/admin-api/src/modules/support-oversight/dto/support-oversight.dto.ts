// apps/admin-api/src/modules/support-oversight/dto/support-oversight.dto.ts · zod .strict() request schemas (reject
// unknown keys → no mass-assignment). Reads are filterable + keyset-bounded; the one mutation (escalate) carries a
// mandatory reason. Severity/status are closed enums; ids are uuids.
import { z } from 'zod';
import { TICKET_STATUSES } from '../domain/ticket.state';
import { SEVERITIES } from '../domain/sla';

const Reason = z.string().min(3).max(1000);
const Cursor = z.string().max(200).optional();
const Limit = z.coerce.number().int().min(1).max(100).default(50);
const Bool = z.enum(['true', 'false']).optional();

export const QueryTicketsSchema = z.object({
  tenantId: z.string().uuid().optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  slaBreached: Bool,
  assigned: Bool,
  cursor: Cursor,
  limit: Limit,
}).strict();
export type QueryTicketsDto = z.infer<typeof QueryTicketsSchema>;

export const QueryBreachesSchema = z.object({
  tenantId: z.string().uuid().optional(),
  severity: z.enum(SEVERITIES).optional(),
  cursor: Cursor,
  limit: Limit,
}).strict();
export type QueryBreachesDto = z.infer<typeof QueryBreachesSchema>;

export const TenantHealthSchema = z.object({
  tenantId: z.string().uuid().optional(),   // present ⇒ single tenant; absent ⇒ top tenants by open SLA breaches
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type TenantHealthDto = z.infer<typeof TenantHealthSchema>;

export const EscalateTicketSchema = z.object({
  severity: z.enum(SEVERITIES).optional(),       // raise only (validated in the domain); omit to escalate status/assignee only
  reassignToUserId: z.string().uuid().optional(),
  reason: Reason,
}).strict();
export type EscalateTicketDto = z.infer<typeof EscalateTicketSchema>;
