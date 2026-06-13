import { z } from 'zod';
export const QueryGroupLotPledgeSchema = z.object({
  groupLotId: z.string().uuid(), cursor: z.string().optional(), limit: z.coerce.number().min(1).max(200).default(50),
}).strict();
export type QueryGroupLotPledgeDto = z.infer<typeof QueryGroupLotPledgeSchema>;
