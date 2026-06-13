import { z } from 'zod';
export const CreateListingAttributeSchema = z.object({
  listingId: z.string().uuid(), attributeId: z.string().uuid(),
  value: z.union([z.string(), z.number(), z.boolean()]), optionId: z.string().uuid().optional(),
}).strict();
export type CreateListingAttributeDto = z.infer<typeof CreateListingAttributeSchema>;
