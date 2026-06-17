// modules/offers/dto/create-listing-offer.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
import { z } from 'zod';

const minor = z.string().regex(/^[1-9]\d{0,15}$/, 'must be a positive integer string of minor units');
const qty = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'must be a positive number with up to 3 decimals');

export const CreateOfferSchema = z.object({
  listingId: z.string().uuid(),
  quantity: qty,
  offeredPriceMinor: minor,                 // buyer's per-unit price offer
  expiresAt: z.string().datetime().optional(),  // default applied in the service (now + 72h)
}).strict();
export type CreateOfferDto = z.infer<typeof CreateOfferSchema>;
