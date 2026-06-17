import { z } from 'zod';
// Checkout converts the buyer's active cart into one order per seller (+ a checkout group
// if multi-seller). Money/payment step is owned by the payments module (feature-flagged).
export const CheckoutSchema = z.object({
  deliveryMethodId: z.string().uuid().optional(),
  deliveryAddressId: z.string().uuid().optional(),
}).strict();
export type CheckoutDto = z.infer<typeof CheckoutSchema>;
