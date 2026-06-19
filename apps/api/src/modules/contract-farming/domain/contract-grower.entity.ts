// modules/contract-farming/domain/contract-grower.entity.ts · the contract_growers aggregate (farmer ↔ contract).
// UNIQUE(contract_id, farmer_user_id, land_parcel_id). committed_quantity is scaled ×1000 (no float).
import { DomainEvent, ContractFarmingEventType } from './contract-farming.events';
import { InvalidGrowerError } from './contract-farming.errors';

export interface ContractGrowerProps {
  id: string; contractId: string; tenantId: string; farmerUserId: string; landParcelId: string | null; committedQuantityMilli: bigint; createdAt?: Date;
}
export class ContractGrower {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: ContractGrowerProps) {}
  static enrol(input: ContractGrowerProps): ContractGrower {
    if (input.committedQuantityMilli <= 0n) throw new InvalidGrowerError('committed quantity must be greater than zero');
    const g = new ContractGrower(input);
    g.events.push({ type: ContractFarmingEventType.GrowerEnrolled, payload: { growerId: g.props.id, contractId: g.props.contractId, farmerUserId: g.props.farmerUserId } });
    return g;
  }
  static rehydrate(props: ContractGrowerProps): ContractGrower { return new ContractGrower(props); }
  get id() { return this.props.id; }
  get contractId() { return this.props.contractId; }
  get farmerUserId() { return this.props.farmerUserId; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toProps(): Readonly<ContractGrowerProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, contractId: v.contractId, farmerUserId: v.farmerUserId, landParcelId: v.landParcelId, committedQuantity: (Number(v.committedQuantityMilli) / 1000).toFixed(3), createdAt: v.createdAt }; }
}
