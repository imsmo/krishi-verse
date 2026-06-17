// modules/payments/dto/create-payout.dto.ts · zod .strict() withdrawal request.
import { z } from 'zod';

export const CreatePayoutSchema = z.object({
  amountMinor: z.string().regex(/^[1-9]\d{0,15}$/, 'amountMinor must be a positive integer string of minor units'),
  bankAccountId: z.string().uuid(),
  purpose: z.enum(['settlement', 'wage', 'commission', 'refund']).default('settlement'),
  currencyCode: z.string().length(3).default('INR'),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
}).strict();
export type CreatePayoutDto = z.infer<typeof CreatePayoutSchema>;
