import { z } from 'zod';
// Checkout converts the buyer's active cart into one order per seller (+ a checkout group
// if multi-seller). Money/payment step is owned by the payments module (feature-flagged).
export const CheckoutSchema = z.object({
  deliveryMethodId: z.string().uuid().optional(),
  deliveryAddressId: z.string().uuid().optional(),
  couponCode: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional(),   // applied to the primary order (promotions)
}).strict();
export type CheckoutDto = z.infer<typeof CheckoutSchema>;

// Read-only totals preview: server-computes the per-seller + grand totals (subtotal + buyer charges +
// member benefits + coupon dry-run) from the buyer's active cart WITHOUT creating an order or moving
// money. Only `couponCode` affects the totals; delivery selection doesn't change the slab here.
export const CheckoutPreviewSchema = z.object({
  couponCode: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional(),
}).strict();
export type CheckoutPreviewDto = z.infer<typeof CheckoutPreviewSchema>;

// Read-only delivery-methods lookup: the serviceable delivery options + their fee for a destination
// (Indian 6-digit pincode and/or a region id). At least one must be provided. No order, no money moved.
export const DeliveryMethodsQuerySchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),   // Indian PIN — fixed length, no ReDoS
  regionId: z.string().uuid().optional(),
}).strict().refine((v) => !!(v.pincode || v.regionId), { message: 'pincode or regionId required' });
export type DeliveryMethodsQueryDto = z.infer<typeof DeliveryMethodsQuerySchema>;
