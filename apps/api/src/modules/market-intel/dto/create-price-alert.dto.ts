// modules/market-intel/dto/create-price-alert.dto.ts · zod .strict() — subscribe to a price threshold.
import { z } from 'zod';
export const CreateAlertSchema = z.object({
  productId: z.string().uuid(),
  regionId: z.string().uuid().nullish(),
  direction: z.enum(['above', 'below']),
  thresholdMinor: z.string().regex(/^\d{1,15}$/),
}).strict();
export type CreateAlertDto = z.infer<typeof CreateAlertSchema>;
