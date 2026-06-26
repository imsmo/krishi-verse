// modules/group-lots/dto/group-lot.dto.ts · zod .strict() payloads + queries for group lots.
import { z } from 'zod';
import { GROUP_LOT_STATUSES } from '../domain/group-lot.state';
const qty = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'quantity, up to 3 decimals');
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a non-negative integer (minor units)');

export const CreateGroupLotSchema = z.object({
  productId: z.string().uuid(),
  targetQuantity: qty,
  unitCode: z.string().min(1).max(20),
  pledgeDeadline: z.string().datetime({ offset: true }),
  coordinationFeeBps: z.number().int().min(0).max(10000).default(0),
}).strict();
export type CreateGroupLotDto = z.infer<typeof CreateGroupLotSchema>;

export const PledgeSchema = z.object({
  farmerUserId: z.string().uuid(),
  quantity: qty,
}).strict();
export type PledgeDto = z.infer<typeof PledgeSchema>;

export const SettleSchema = z.object({
  grossProceedsMinor: minorStr,
}).strict();
export type SettleDto = z.infer<typeof SettleSchema>;

export const QueryGroupLotsSchema = z.object({
  box: z.enum(['mine', 'all']).default('all'),    // mine = coordinator's own; all = browse (any authed user)
  status: z.enum(GROUP_LOT_STATUSES as unknown as [string, ...string[]]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryGroupLotsDto = z.infer<typeof QueryGroupLotsSchema>;
