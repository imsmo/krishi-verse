import { z } from 'zod';
export const QueryProductSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().default(true),
}).strict();
export type QueryProductDto = z.infer<typeof QueryProductSchema>;
