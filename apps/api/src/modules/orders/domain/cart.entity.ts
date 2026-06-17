// modules/orders/domain/cart.entity.ts · the buyer's active cart (one per tenant×user).
export interface CartProps { id: string; tenantId: string; userId: string; status: 'active' | 'converted' | 'abandoned'; }
export class Cart {
  constructor(readonly props: CartProps) {}
  static createActive(input: { id: string; tenantId: string; userId: string }): Cart { return new Cart({ ...input, status: 'active' }); }
  get id() { return this.props.id; }
}
