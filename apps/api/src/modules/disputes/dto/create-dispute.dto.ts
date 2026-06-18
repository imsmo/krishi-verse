// modules/disputes/dto/create-dispute.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
// The client sends only the order + a reason CODE (resolved to a lookup_value id server-side) + free
// text; the counterparty (against_user) is resolved from eligibility — never client-supplied (anti-IDOR).
import { z } from 'zod';

export const DISPUTE_REASON_CODES = ['not_delivered', 'poor_quality', 'qty_mismatch', 'late', 'wrong_item', 'damaged', 'payment', 'bid_manipulation', 'fake_certificate'] as const;

export const CreateDisputeSchema = z.object({
  orderId: z.string().uuid(),
  reasonCode: z.enum(DISPUTE_REASON_CODES),
  description: z.string().max(4000).optional(),
}).strict();
export type CreateDisputeDto = z.infer<typeof CreateDisputeSchema>;
