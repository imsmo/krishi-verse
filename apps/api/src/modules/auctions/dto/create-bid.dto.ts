// modules/auctions/dto/create-bid.dto.ts · zod .strict() bid payload. Amount is a minor-unit string.
import { z } from 'zod';

export const CreateBidSchema = z.object({
  amountMinor: z.string().regex(/^[1-9]\d{0,15}$/, 'amountMinor must be a positive integer string of minor units'),
}).strict();
export type CreateBidDto = z.infer<typeof CreateBidSchema>;
