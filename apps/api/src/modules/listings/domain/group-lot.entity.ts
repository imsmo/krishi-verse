// modules/listings/domain/group-lot.entity.ts
// FPO pooling aggregate (PRD §7.7). Tracks pledged vs target; auto-ready at target.
import { GroupLotStatus, assertGroupLotTransition } from './group-lot.state';
import { DomainError } from '../../../shared/errors/app-error';

export interface GroupLotProps {
  id: string; tenantId: string; coordinatorUserId: string; productId: string;
  targetQuantity: number; pledgedQuantity: number; unitCode: string;
  pledgeDeadline: Date; status: GroupLotStatus; coordinationFeeBps: number; version: number;
}
export class GroupLot {
  constructor(private props: GroupLotProps) {}
  static create(p: Omit<GroupLotProps,'status'|'pledgedQuantity'|'version'>) {
    if (p.targetQuantity <= 0) throw new DomainError('GROUP_LOT_INVALID_TARGET','Target must be positive',422);
    if (p.coordinationFeeBps < 0 || p.coordinationFeeBps > 2000)
      throw new DomainError('GROUP_LOT_INVALID_FEE','Coordination fee out of range (<=20%)',422);
    return new GroupLot({ ...p, pledgedQuantity: 0, status: 'pledging', version: 1 });
  }
  static rehydrate(p: GroupLotProps) { return new GroupLot(p); }
  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get version() { return this.props.version; }
  toProps() { return { ...this.props }; }

  addPledge(qty: number, now = new Date()): void {
    if (this.props.status !== 'pledging') throw new DomainError('GROUP_LOT_NOT_PLEDGING','Pledging closed',409);
    if (now > this.props.pledgeDeadline) throw new DomainError('GROUP_LOT_DEADLINE_PASSED','Pledge deadline passed',409);
    if (qty <= 0) throw new DomainError('GROUP_LOT_INVALID_QTY','Pledge must be positive',422);
    this.props.pledgedQuantity += qty;
    if (this.props.pledgedQuantity >= this.props.targetQuantity) this.transition('ready');
  }
  removePledge(qty: number): void {
    this.props.pledgedQuantity = Math.max(0, this.props.pledgedQuantity - qty);
    if (this.props.status === 'ready' && this.props.pledgedQuantity < this.props.targetQuantity) this.transition('pledging');
  }
  private transition(to: GroupLotStatus) { assertGroupLotTransition(this.props.status, to); this.props.status = to; }
  markListed() { this.transition('listed'); }
  markSold() { this.transition('sold'); }
  markSettled() { this.transition('settled'); }
  cancel() { this.transition('cancelled'); }
}
