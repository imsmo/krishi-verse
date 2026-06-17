// modules/offers/dto/update-listing-offer.dto.ts · zod .strict() counter payload (the only mutation body).
import { z } from 'zod';

export const CounterOfferSchema = z.object({
  priceMinor: z.string().regex(/^[1-9]\d{0,15}$/, 'priceMinor must be a positive integer string of minor units'),
}).strict();
export type CounterOfferDto = z.infer<typeof CounterOfferSchema>;
