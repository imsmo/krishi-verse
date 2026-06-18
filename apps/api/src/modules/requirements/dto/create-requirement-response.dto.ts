// modules/requirements/dto/create-requirement-response.dto.ts · zod .strict() seller-quote payload.
import { z } from 'zod';

export const CreateResponseSchema = z.object({
  quotedPriceMinor: z.string().regex(/^[1-9]\d{0,15}$/, 'quotedPriceMinor must be a positive integer string of minor units'),
  quantity: z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'must be a positive number with up to 3 decimals'),
  listingId: z.string().uuid().optional(),       // required to ACCEPT into an order (enforced at accept)
  validUntil: z.string().datetime().optional(),
  message: z.string().max(1000).optional(),
}).strict();
export type CreateResponseDto = z.infer<typeof CreateResponseSchema>;
