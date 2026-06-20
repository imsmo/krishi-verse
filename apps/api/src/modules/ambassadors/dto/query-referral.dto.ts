// modules/ambassadors/dto/query-referral.dto.ts · zod .strict() — list the caller's referrals (keyset).
import { z } from 'zod';
import { REFERRAL_STATUSES } from '../domain/ambassadors.events';
export const QueryReferralsSchema = z.object({
  status: z.enum(REFERRAL_STATUSES as unknown as [string, ...string[]]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryReferralsDto = z.infer<typeof QueryReferralsSchema>;
