// modules/orders/domain/checkout-group.entity.ts · one payment spanning many sub-orders (multi-seller cart).
export interface CheckoutGroupProps { id: string; tenantId: string; buyerUserId: string; totalMinor: bigint; currencyCode: string; }
export class CheckoutGroup {
  constructor(readonly props: CheckoutGroupProps) {}
  static of(input: CheckoutGroupProps): CheckoutGroup { return new CheckoutGroup(input); }
}
