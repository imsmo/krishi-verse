// modules/orders/dto/create-cart.dto.ts · zod .strict() cart ensure/clear payload. The buyer has at most
// ONE active cart per (tenant, user) (carts UNIQUE), created lazily on first add — so "create" is really
// "ensure my active cart exists". No user_id from the client (it's the caller); no unknown keys.
import { z } from 'zod';

export const EnsureCartSchema = z.object({}).strict();
export type EnsureCartDto = z.infer<typeof EnsureCartSchema>;
