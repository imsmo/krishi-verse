// modules/listings/dto/query-listing.dto.ts · cursor pagination + filters (read path).
import { z } from 'zod';
export const QueryListingSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),                 // free-text (title match; vernacular synonyms in Phase 2)
  categoryId: z.string().uuid().optional(),
  pincode: z.string().regex(/^\d{4,10}$/).optional(),
  regionId: z.string().uuid().optional(),
  organic: z.coerce.boolean().optional(),
  saleType: z.enum(['direct', 'auction', 'both', 'preorder', 'service', 'group_lot']).optional(),
  priceMinMinor: z.string().regex(/^\d+$/).optional(),
  priceMaxMinor: z.string().regex(/^\d+$/).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'distance']).default('newest'),
  lat: z.coerce.number().optional(), lng: z.coerce.number().optional(),
}).strict();
export type QueryListingDto = z.infer<typeof QueryListingSchema>;
