import { z } from 'zod';
export const CreateGroupLotSchema = z.object({
  productId: z.string().uuid(),
  targetQuantity: z.number().positive(),
  unitCode: z.string().min(1).max(20),
  pledgeDeadline: z.string().datetime(),
  coordinationFeeBps: z.number().int().min(0).max(2000).default(0),
}).strict();
export type CreateGroupLotDto = z.infer<typeof CreateGroupLotSchema>;
