import { z } from 'zod';
// Checkout converts the buyer's active cart into one order per seller (+ a checkout group
// if multi-seller). Money/payment step is owned by the payments module (feature-flagged).
export const CheckoutSchema = z.object({
  deliveryMethodId: z.string().uuid().optional(),
  deliveryAddressId: z.string().uuid().optional(),
  couponCode: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional(),   // applied to the primary order (promotions)
}).strict();
export type CheckoutDto = z.infer<typeof CheckoutSchema>;
