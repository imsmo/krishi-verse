import { z } from 'zod';
export const QueryGroupLotSchema = z.object({
  cursor: z.string().optional(), limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pledging','ready','listed','sold','settled','cancelled']).optional(),
}).strict();
export type QueryGroupLotDto = z.infer<typeof QueryGroupLotSchema>;
