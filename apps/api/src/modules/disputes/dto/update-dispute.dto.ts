// modules/disputes/dto/update-dispute.dto.ts · zod .strict() resolution payload (moderator decision).
import { z } from 'zod';
import { RESOLUTION_TYPES } from '../domain/disputes.events';

export const ResolveDisputeSchema = z.object({
  resolutionType: z.enum(RESOLUTION_TYPES as unknown as [string, ...string[]]),
  resolutionAmountMinor: z.string().regex(/^[1-9]\d{0,15}$/, 'must be a positive integer string of minor units').optional(),
  note: z.string().max(2000).optional(),
}).strict();
export type ResolveDisputeDto = z.infer<typeof ResolveDisputeSchema>;
