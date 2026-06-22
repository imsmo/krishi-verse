// modules/payments/dto/query-commission-rule.dto.ts · list the tenant's commission rules, keyset pagination.
import { z } from 'zod';
export const QueryCommissionRuleSchema = z.object({
  activeOnly: z.coerce.boolean().default(true),
  includePlatformDefaults: z.coerce.boolean().default(false),   // also show inherited platform defaults (read-only)
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryCommissionRuleDto = z.infer<typeof QueryCommissionRuleSchema>;
