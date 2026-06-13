import { z } from 'zod';
export const QueryListingAttributeSchema = z.object({ listingId: z.string().uuid() }).strict();
export type QueryListingAttributeDto = z.infer<typeof QueryListingAttributeSchema>;
