// modules/auctions/domain/bid.entity.ts
// A bid is IMMUTABLE (append-only — DB grants revoke UPDATE/DELETE on `bids`). This is the in-memory
// value object created before insert; once written it is never mutated. Money is bigint minor units.
import { InvalidAuctionError } from './auctions.errors';

export interface BidProps {
  id: string; tenantId: string; auctionId: string; bidderUserId: string;
  amountMinor: bigint; isSealed: boolean; emdTxnId: string | null; ip: string | null; deviceFingerprint: string | null;
}

export class Bid {
  private constructor(readonly props: BidProps) {}
  static place(input: { id: string; tenantId: string; auctionId: string; bidderUserId: string; amountMinor: bigint; isSealed?: boolean; emdTxnId?: string | null; ip?: string | null; deviceFingerprint?: string | null }): Bid {
    if (input.amountMinor <= 0n) throw new InvalidAuctionError('bid amount must be positive');
    return new Bid({ id: input.id, tenantId: input.tenantId, auctionId: input.auctionId, bidderUserId: input.bidderUserId, amountMinor: input.amountMinor, isSealed: input.isSealed ?? false, emdTxnId: input.emdTxnId ?? null, ip: input.ip ?? null, deviceFingerprint: input.deviceFingerprint ?? null });
  }
}
