// modules/promotions/dto/create-coupon.dto.ts · zod .strict() coupon-code payload.
import { z } from 'zod';
export const CreateCouponSchema = z.object({
  promotionId: z.string().uuid(),
  code: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/, 'code must be 3..40 chars of A-Z 0-9 _ -'),
  maxUses: z.number().int().min(1).max(100_000_000).optional(),
  perUserLimit: z.number().int().min(1).max(1000).optional(),
}).strict();
export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
