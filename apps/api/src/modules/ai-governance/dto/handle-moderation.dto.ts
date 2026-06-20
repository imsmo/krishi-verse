// modules/ai-governance/dto/handle-moderation.dto.ts · zod .strict() — a moderator's decision on a report.
import { z } from 'zod';
import { MODERATION_ACTIONS } from '../domain/ai-governance.events';
export const HandleReportSchema = z.object({
  status: z.enum(['actioned', 'dismissed']),
  action: z.enum(MODERATION_ACTIONS).nullish(),            // required when status='actioned' (enforced in domain)
  note: z.string().max(1000).nullish(),
}).strict();
export type HandleReportDto = z.infer<typeof HandleReportSchema>;
