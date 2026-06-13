// modules/listings/dto/create-listing-boost.dto.ts
// Start a paid visibility boost. priceMinor is sent as a STRING (bigint minor units,
// never a float — Law 1). paymentTxnId is the wallet-service capture reference that
// proves payment was taken before the boost is recorded (Law 2).
import { z } from 'zod';
const MinorStr = z.string().regex(/^\d{1,19}$/, 'minor units as integer string');
export const CreateListingBoostSchema = z.object({
  boostTierId: z.string().uuid(),
  priceMinor: MinorStr,
  currencyCode: z.string().length(3),
  days: z.number().int().min(1).max(90),
  paymentTxnId: z.string().min(1),
}).strict();
export type CreateListingBoostDto = z.infer<typeof CreateListingBoostSchema>;
// Controller-facing aliases
export const CreateBoostSchema = CreateListingBoostSchema;
export type CreateBoostDto = CreateListingBoostDto;
