import { z } from 'zod';
export const CancelOrderSchema = z.object({ reasonId: z.string().uuid().optional() }).strict();
export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;
export const DisputeOrderSchema = z.object({ note: z.string().max(1000).optional() }).strict();
export type DisputeOrderDto = z.infer<typeof DisputeOrderSchema>;
