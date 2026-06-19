// modules/contract-farming/domain/input-advance.entity.ts · the contract_input_advances aggregate.
// Buyer-supplied seed/inputs disbursed to a grower; value_minor is bigint minor units (Law 2), recovered at
// settlement. The disbursement wallet move (buyer → grower) is posted by the service.
import { DomainEvent, ContractFarmingEventType } from './contract-farming.events';
import { InvalidAdvanceError } from './contract-farming.errors';

export interface InputAdvanceProps {
  id: string; contractId: string; growerId: string; tenantId: string; productId: string | null; description: string | null;
  valueMinor: bigint; recoveredMinor: bigint; createdAt?: Date;
}
export class InputAdvance {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: InputAdvanceProps) {}
  static disburse(input: Omit<InputAdvanceProps, 'recoveredMinor'>): InputAdvance {
    if (input.valueMinor <= 0n) throw new InvalidAdvanceError('advance value must be greater than zero');
    const a = new InputAdvance({ ...input, recoveredMinor: 0n });
    a.events.push({ type: ContractFarmingEventType.AdvanceDisbursed, payload: { advanceId: a.props.id, contractId: a.props.contractId, growerId: a.props.growerId, valueMinor: a.props.valueMinor.toString() } });
    return a;
  }
  static rehydrate(props: InputAdvanceProps): InputAdvance { return new InputAdvance(props); }
  get id() { return this.props.id; }
  get growerId() { return this.props.growerId; }
  get valueMinor() { return this.props.valueMinor; }
  get recoveredMinor() { return this.props.recoveredMinor; }
  get outstandingMinor() { return this.props.valueMinor - this.props.recoveredMinor; }
  /** Recover up to the outstanding balance; returns the amount actually recovered. */
  recover(upToMinor: bigint): bigint {
    const amount = upToMinor < this.outstandingMinor ? upToMinor : this.outstandingMinor;
    if (amount <= 0n) return 0n;
    this.props.recoveredMinor += amount;
    return amount;
  }
  toProps(): Readonly<InputAdvanceProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { id: v.id, contractId: v.contractId, growerId: v.growerId, productId: v.productId, description: v.description, valueMinor: v.valueMinor.toString(), recoveredMinor: v.recoveredMinor.toString(), outstandingMinor: this.outstandingMinor.toString(), createdAt: v.createdAt }; }
}
