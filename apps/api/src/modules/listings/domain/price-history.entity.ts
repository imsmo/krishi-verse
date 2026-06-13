// modules/listings/domain/price-history.entity.ts · immutable price-change record (append-only).
export interface PriceHistoryProps {
  id: string; tenantId: string; listingId: string;
  oldPriceMinor: bigint | null; newPriceMinor: bigint; changedBy: string; createdAt: Date;
}
export class PriceHistory {
  private constructor(readonly props: PriceHistoryProps) {}
  static record(p: Omit<PriceHistoryProps,'createdAt'>) { return new PriceHistory({ ...p, createdAt: new Date() }); }
}
