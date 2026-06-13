// modules/listings/domain/group-lot-pledge.entity.ts · a member's pledged quantity + settlement share.
export interface GroupLotPledgeProps {
  id: string; tenantId: string; groupLotId: string; farmerUserId: string;
  quantity: number; qualityOk?: boolean | null; settledShareMinor?: bigint | null;
}
export class GroupLotPledge {
  constructor(readonly props: GroupLotPledgeProps) {}
  static of(p: GroupLotPledgeProps) {
    if (p.quantity <= 0) throw new Error('PLEDGE_INVALID_QTY');
    return new GroupLotPledge(p);
  }
  /** Proportional settlement share = pledge/totalPledged × netProceeds (minor units). */
  computeShare(totalPledged: number, netProceedsMinor: bigint): bigint {
    if (totalPledged <= 0) return 0n;
    return (netProceedsMinor * BigInt(Math.round(this.props.quantity * 1e6))) / BigInt(Math.round(totalPledged * 1e6));
  }
}
