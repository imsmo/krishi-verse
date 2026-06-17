import { z } from 'zod';
export const QueryOrderSchema = z.object({
  role: z.enum(['buyer', 'seller']).default('buyer'),
  status: z.string().max(30).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type QueryOrderDto = z.infer<typeof QueryOrderSchema>;
