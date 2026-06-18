// modules/promotions/dto/create-coupon-redemption.dto.ts · zod .strict() validate + redeem payloads.
import { z } from 'zod';
const minorPos = z.string().regex(/^[1-9]\d{0,15}$/, 'subtotalMinor must be a positive integer string of minor units');

// preview only — computes the discount + validity, no state change.
export const ValidateCouponSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/),
  subtotalMinor: minorPos,
}).strict();
export type ValidateCouponDto = z.infer<typeof ValidateCouponSchema>;

// authoritative redemption — bound to an order (UNIQUE per coupon+order; idempotent).
export const RedeemCouponSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/),
  orderId: z.string().uuid(),
  subtotalMinor: minorPos,
}).strict();
export type RedeemCouponDto = z.infer<typeof RedeemCouponSchema>;
