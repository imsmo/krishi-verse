import { z } from 'zod';
export const AddToCartSchema = z.object({ listingId: z.string().uuid(), quantity: z.number().positive().max(1_000_000) }).strict();
export type AddToCartDto = z.infer<typeof AddToCartSchema>;
export const UpdateCartItemSchema = z.object({ quantity: z.number().positive().max(1_000_000) }).strict();
export type UpdateCartItemDto = z.infer<typeof UpdateCartItemSchema>;
