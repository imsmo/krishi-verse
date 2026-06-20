// modules/support/dto/update-support-ticket.dto.ts · zod .strict() — agent actions (assign / transition / csat).
import { z } from 'zod';
import { TICKET_STATUSES } from '../domain/support-ticket.state';
export const AssignTicketSchema = z.object({ assigneeUserId: z.string().uuid() }).strict();
export type AssignTicketDto = z.infer<typeof AssignTicketSchema>;

// transitions an agent may drive directly (resolve/close/reopen/escalate/pending_* /open)
const AGENT_TRANSITIONS = ['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed', 'reopened'] as const;
export const TransitionTicketSchema = z.object({
  to: z.enum(AGENT_TRANSITIONS as unknown as [string, ...string[]]),
  note: z.string().max(2000).nullish(),
}).strict();
export type TransitionTicketDto = z.infer<typeof TransitionTicketSchema>;

export const CsatSchema = z.object({ score: z.coerce.number().int().min(1).max(5) }).strict();
export type CsatDto = z.infer<typeof CsatSchema>;
export { TICKET_STATUSES };
