// modules/orders/domain/cart-item.entity.ts · a line in the cart (price snapshot for drift detection).
import { InvalidQuantityError } from './orders.errors';
export interface CartItemProps { id: string; cartId: string; listingId: string; quantity: number; addedPriceMinor: bigint; }
export class CartItem {
  constructor(readonly props: CartItemProps) {}
  static of(input: CartItemProps): CartItem { if (input.quantity <= 0) throw new InvalidQuantityError(); return new CartItem(input); }
}
