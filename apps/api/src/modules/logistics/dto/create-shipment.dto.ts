// modules/logistics/dto/create-shipment.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
// Shipments are normally auto-created from orders.order_confirmed; this manual create is for ops.
import { z } from 'zod';
const minor0 = z.string().regex(/^\d{1,16}$/, 'must be a non-negative integer string of minor units');

export const CreateShipmentSchema = z.object({
  orderId: z.string().uuid(),
  pickupAddressId: z.string().uuid().optional(),
  dropAddressId: z.string().uuid().optional(),
  chargeMinor: minor0.optional(),
  codMinor: minor0.optional(),
  requiresColdChain: z.boolean().optional(),
}).strict();
export type CreateShipmentDto = z.infer<typeof CreateShipmentSchema>;
