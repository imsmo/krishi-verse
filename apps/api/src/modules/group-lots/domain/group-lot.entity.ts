// modules/group-lots/domain/group-lot.entity.ts · the group_lots aggregate (FPO pooling, 0005). Quantities are
// stored as numeric(14,3) decimal strings; the entity tracks pledged vs target and guards the lifecycle.
// serialize() is the wire shape. Money (coordination fee bps + settled shares) is computed float-free elsewhere.
import { GroupLotStatus, assertTransition } from './group-lot.state';
import { DomainEvent, GroupLotEventType } from './group-lot.events';
import { InvalidGroupLotError, PledgeClosedError } from './group-lot.errors';
import { parseQtyMilli, formatQtyMilli } from './settle';

export interface GroupLotProps {
  id: string; tenantId: string; coordinatorUserId: string; productId: string;
  targetQuantity: string; pledgedQuantity: string; unitCode: string;
  pledgeDeadline: string; status: GroupLotStatus; coordinationFeeBps: number; createdAt?: Date;
}

export class GroupLot {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: GroupLotProps) {}

  static create(input: Omit<GroupLotProps, 'pledgedQuantity' | 'status'>): GroupLot {
    if (parseQtyMilli(input.targetQuantity) <= 0n) throw new InvalidGroupLotError('target quantity must be greater than zero');
    if (input.coordinationFeeBps < 0 || input.coordinationFeeBps > 10000) throw new InvalidGroupLotError('coordination fee bps out of range');
    const g = new GroupLot({ ...input, pledgedQuantity: '0.000', status: 'pledging' });
    g.events.push({ type: GroupLotEventType.Created, payload: { groupLotId: g.props.id, productId: g.props.productId, targetQuantity: g.props.targetQuantity } });
    return g;
  }
  static rehydrate(props: GroupLotProps): GroupLot { return new GroupLot(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get status() { return this.props.status; }
  get coordinationFeeBps() { return this.props.coordinationFeeBps; }
  toProps(): Readonly<GroupLotProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Add a pledged quantity (milli) to the running total — only while pledging + before the deadline. */
  applyPledge(qtyMilli: bigint, now: Date): void {
    if (this.props.status !== 'pledging') throw new PledgeClosedError();
    if (new Date(this.props.pledgeDeadline).getTime() <= now.getTime()) throw new PledgeClosedError();
    const next = parseQtyMilli(this.props.pledgedQuantity) + qtyMilli;
    this.props.pledgedQuantity = formatQtyMilli(next);
    this.events.push({ type: GroupLotEventType.Pledged, payload: { groupLotId: this.props.id, pledgedQuantity: this.props.pledgedQuantity } });
  }
  markReady(): void {
    assertTransition(this.props.status, 'ready');
    this.props.status = 'ready';
    this.events.push({ type: GroupLotEventType.Ready, payload: { groupLotId: this.props.id, pledgedQuantity: this.props.pledgedQuantity } });
  }
  reopen(): void { assertTransition(this.props.status, 'pledging'); this.props.status = 'pledging'; }
  cancel(): void {
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled';
    this.events.push({ type: GroupLotEventType.Cancelled, payload: { groupLotId: this.props.id } });
  }
  markSettled(): void {
    assertTransition(this.props.status, 'settled');
    this.props.status = 'settled';
    this.events.push({ type: GroupLotEventType.Settled, payload: { groupLotId: this.props.id } });
  }

  /** Fraction pledged, as integer basis points of target (display only; float-free). */
  pledgeProgressBps(): number {
    const target = parseQtyMilli(this.props.targetQuantity);
    if (target <= 0n) return 0;
    const pct = (parseQtyMilli(this.props.pledgedQuantity) * 10000n) / target;
    return Number(pct > 10000n ? 10000n : pct);
  }

  serialize() {
    const p = this.props;
    return { id: p.id, coordinatorUserId: p.coordinatorUserId, productId: p.productId, targetQuantity: p.targetQuantity,
      pledgedQuantity: p.pledgedQuantity, unitCode: p.unitCode, pledgeDeadline: p.pledgeDeadline, status: p.status,
      coordinationFeeBps: p.coordinationFeeBps, progressBps: this.pledgeProgressBps(), createdAt: p.createdAt };
  }
}
