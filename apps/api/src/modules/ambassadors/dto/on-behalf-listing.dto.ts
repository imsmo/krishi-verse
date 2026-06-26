// modules/ambassadors/dto/on-behalf-listing.dto.ts · an active ambassador creates a listing ON BEHALF of an
// onboarded farmer (P1-16). Consent-gated: the farmer must have granted 'on_behalf_listing' consent to this
// ambassador. Reuses the listings CreateListingSchema verbatim for the listing payload (one source of truth).
import { z } from 'zod';
import { CreateListingSchema } from '../../listings/dto/create-listing.dto';

export const OnBehalfListingSchema = z.object({
  farmerUserId: z.string().uuid(),               // the seller — re-checked for consent server-side
  listing: CreateListingSchema,
}).strict();
export type OnBehalfListingDto = z.infer<typeof OnBehalfListingSchema>;
