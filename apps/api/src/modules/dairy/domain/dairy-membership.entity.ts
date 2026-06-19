// modules/dairy/domain/dairy-membership.entity.ts · the dairy_memberships aggregate (farmer ↔ MCC route).
// UNIQUE(tenant_id, mcc_id, member_code). The farmer_user_id is the milk supplier paid by the cooperative.
import { PaymentCycle, AnimalType, DomainEvent, DairyEventType } from './dairy.events';

export interface DairyMembershipProps {
  id: string; tenantId: string; farmerUserId: string; mccId: string; memberCode: string;
  paymentCycle: PaymentCycle; defaultAnimalType: AnimalType | null; isActive: boolean; createdAt?: Date;
}
export class DairyMembership {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: DairyMembershipProps) {}
  static create(input: Omit<DairyMembershipProps, 'isActive' | 'createdAt'> & { isActive?: boolean }): DairyMembership {
    const m = new DairyMembership({ ...input, isActive: input.isActive ?? true });
    m.events.push({ type: DairyEventType.MembershipCreated, payload: { membershipId: m.props.id, farmerUserId: m.props.farmerUserId, mccId: m.props.mccId } });
    return m;
  }
  static rehydrate(props: DairyMembershipProps): DairyMembership { return new DairyMembership(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get farmerUserId() { return this.props.farmerUserId; }
  get defaultAnimalType() { return this.props.defaultAnimalType; }
  toProps(): Readonly<DairyMembershipProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { id: v.id, farmerUserId: v.farmerUserId, mccId: v.mccId, memberCode: v.memberCode,
    paymentCycle: v.paymentCycle, defaultAnimalType: v.defaultAnimalType, isActive: v.isActive, createdAt: v.createdAt }; }
}
