// modules/disputes/dto/create-return.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
// The buyer sends the order + an optional reason CODE (resolved to a lookup_value id server-side) and an
// optional dispute link. The order's buyer/seller are resolved from eligibility — never client-supplied
// (anti-IDOR). Reuses the dispute_reason taxonomy (damaged/wrong_item/poor_quality/… ).
import { z } from 'zod';
import { DISPUTE_REASON_CODES } from './create-dispute.dto';

export const CreateReturnSchema = z.object({
  orderId: z.string().uuid(),
  reasonCode: z.enum(DISPUTE_REASON_CODES).optional(),
  disputeId: z.string().uuid().optional(),
}).strict();
export type CreateReturnDto = z.infer<typeof CreateReturnSchema>;
