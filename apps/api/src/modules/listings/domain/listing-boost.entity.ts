// modules/listings/domain/listing-boost.entity.ts
// Paid visibility boost (revenue stream). Time-bounded; money in minor units.
export interface ListingBoostProps {
  id: string; tenantId: string; listingId: string; buyerUserId: string;
  boostTierId: string; priceMinor: bigint; currencyCode: string;
  startsAt: Date; endsAt: Date; paymentTxnId?: string | null;
}
export class ListingBoost {
  constructor(readonly props: ListingBoostProps) {}
  static create(p: ListingBoostProps) {
    if (p.endsAt <= p.startsAt) throw new Error('BOOST_INVALID_WINDOW');
    if (p.priceMinor <= 0n) throw new Error('BOOST_INVALID_PRICE');
    return new ListingBoost(p);
  }
  isActive(now = new Date()) { return now >= this.props.startsAt && now < this.props.endsAt; }
}
