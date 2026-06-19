// modules/contract-farming/domain/contract-milestone.entity.ts · the contract_milestones aggregate.
// Sowing/midseason/preharvest/delivery/payment gates with geo-photo evidence. No money (settlement is the
// contract's job). completed_at stamps completion.
import { MilestoneType, DomainEvent, ContractFarmingEventType } from './contract-farming.events';

export interface ContractMilestoneProps {
  id: string; contractId: string; growerId: string | null; tenantId: string; milestoneType: MilestoneType; dueOn: string | null;
  completedAt: Date | null; evidenceMediaId: string | null; data: Record<string, unknown>; createdAt?: Date;
}
export class ContractMilestone {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ContractMilestoneProps) {}
  static record(input: Omit<ContractMilestoneProps, 'completedAt'> & { completedAt?: Date | null }): ContractMilestone {
    const m = new ContractMilestone({ ...input, completedAt: input.completedAt ?? null });
    m.events.push({ type: ContractFarmingEventType.MilestoneRecorded, payload: { milestoneId: m.props.id, contractId: m.props.contractId, milestoneType: m.props.milestoneType } });
    return m;
  }
  static rehydrate(props: ContractMilestoneProps): ContractMilestone { return new ContractMilestone(props); }
  get id() { return this.props.id; }
  get contractId() { return this.props.contractId; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  complete(now: Date, evidenceMediaId: string | null, data?: Record<string, unknown>): void {
    this.props.completedAt = now;
    if (evidenceMediaId) this.props.evidenceMediaId = evidenceMediaId;
    if (data) this.props.data = { ...this.props.data, ...data };
    this.events.push({ type: ContractFarmingEventType.MilestoneCompleted, payload: { milestoneId: this.props.id, contractId: this.props.contractId } });
  }
  toProps(): Readonly<ContractMilestoneProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, contractId: v.contractId, growerId: v.growerId, milestoneType: v.milestoneType, dueOn: v.dueOn, completedAt: v.completedAt, evidenceMediaId: v.evidenceMediaId, data: v.data, createdAt: v.createdAt }; }
}
