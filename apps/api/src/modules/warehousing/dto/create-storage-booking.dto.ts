// modules/warehousing/dto/create-storage-booking.dto.ts · zod .strict() deposit request payload.
// quantity is a decimal string (parsed to a scaled integer; no float). Storage fee is server-computed.
import { z } from 'zod';
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const RequestBookingSchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'quantity, up to 3 decimals'),
  unitCode: z.string().min(1).max(20),
  expectedArrival: dateStr.optional(),
}).strict();
export type RequestBookingDto = z.infer<typeof RequestBookingSchema>;
