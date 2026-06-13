// modules/listings/domain/listing-attribute.entity.ts
// Lot-level dynamic attribute value (typed EAV — descriptive data only, Law 8 line).
export type AttrValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; number: number }
  | { kind: 'bool'; bool: boolean }
  | { kind: 'date'; date: string }
  | { kind: 'option'; optionId: string };

export interface ListingAttributeProps {
  id: string; tenantId: string; listingId: string; attributeId: string; value: AttrValue;
}
export class ListingAttribute {
  constructor(readonly props: ListingAttributeProps) {}
  static of(p: ListingAttributeProps) {
    if (p.value.kind === 'number' && Number.isNaN(p.value.number))
      throw new Error('LISTING_ATTR_INVALID_NUMBER');
    return new ListingAttribute(p);
  }
}
