// modules/orders/dto/create-order-item.dto.ts · zod .strict() partial-fulfilment record. Order items are
// created (frozen) by checkout; the only post-hoc mutation is recording the DELIVERED quantity per line
// (PRD §9.6 partial fulfilment). quantity is numeric(14,3) → up to 3 decimals, non-negative, ≤ ordered.
import { z } from 'zod';

export const RecordDeliveredItemSchema = z.object({
  deliveredQuantity: z.number().nonnegative().max(1_000_000_000),
}).strict();
export type RecordDeliveredItemDto = z.infer<typeof RecordDeliveredItemSchema>;
