// modules/listings/dto/change-price.dto.ts
import { z } from 'zod';
export const ChangePriceSchema = z.object({
  priceMinor: z.string().regex(/^[1-9]\d{0,15}$/),
  expectedVersion: z.number().int().nonnegative(),
}).strict();
export type ChangePriceDto = z.infer<typeof ChangePriceSchema>;
