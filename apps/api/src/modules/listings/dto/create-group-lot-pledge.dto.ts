// modules/listings/dto/create-group-lot-pledge.dto.ts · a farmer's pledge into a group lot.
import { z } from 'zod';
export const CreateGroupLotPledgeSchema = z.object({
  quantity: z.number().positive().finite(),
}).strict();
export type CreateGroupLotPledgeDto = z.infer<typeof CreateGroupLotPledgeSchema>;
export const PledgeSchema = CreateGroupLotPledgeSchema;
export type PledgeDto = CreateGroupLotPledgeDto;
