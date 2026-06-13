// modules/listings/dto/update-listing.dto.ts · partial update; never allow
// tenant/owner/status override here (status flows through dedicated endpoints).
import { z } from 'zod';
export const UpdateListingSchema = z.object({
  title: z.string().trim().min(3).max(250).optional(),
  description: z.string().max(5000).optional(),
  minOrderQty: z.number().min(0).optional(),
  quantityTotal: z.number().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  expectedVersion: z.number().int().nonnegative(), // optimistic concurrency (required)
}).strict();
export type UpdateListingDto = z.infer<typeof UpdateListingSchema>;
