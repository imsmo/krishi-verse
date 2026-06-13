import { z } from 'zod';
export const QueryListingBoostSchema = z.object({
  listingId: z.string().uuid().optional(), activeOnly: z.coerce.boolean().default(true),
}).strict();
export type QueryListingBoostDto = z.infer<typeof QueryListingBoostSchema>;
