// modules/audit/dto/audit.dto.ts · zod .strict() query for the read-only audit-trail browse.
// All filters optional; results are keyset-paginated (created_at DESC, id DESC). Free-text is NOT
// supported (the trail is structured) — filter by action / entity / actor / time window only.
import { z } from 'zod';

export const QueryAuditSchema = z.object({
  action: z.string().min(1).max(120).optional(),       // exact action key, e.g. 'kyc.approved'
  entityType: z.string().min(1).max(60).optional(),    // e.g. 'order','milk_bill'
  entityId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),  // inclusive lower bound on created_at
  to: z.string().datetime({ offset: true }).optional(),    // exclusive upper bound on created_at
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryAuditDto = z.infer<typeof QueryAuditSchema>;
