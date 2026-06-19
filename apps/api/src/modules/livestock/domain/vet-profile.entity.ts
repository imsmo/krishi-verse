// modules/livestock/domain/vet-profile.entity.ts · the vet_profiles aggregate (VCI-registered vet / AI tech).
// A user self-registers ONE vet profile (user_id UNIQUE). KYC of the degree doc is handled by the media/KYC
// modules (degree_doc_id reference); here we hold the marketplace-facing profile.
import { LivestockEventType, DomainEvent } from './livestock.events';

export interface VetProfileProps {
  id: string;
  userId: string;
  tenantId: string | null;
  registrationNo: string;
  isAiTechnician: boolean;
  serviceRadiusKm: number;
  baseRegionId: string | null;
  ratingAvg: number | null;
  createdAt?: Date;
}
export class VetProfile {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: VetProfileProps) {}
  static register(input: { id: string; userId: string; tenantId: string; registrationNo: string; isAiTechnician?: boolean; serviceRadiusKm?: number; baseRegionId?: string | null }): VetProfile {
    const v = new VetProfile({ id: input.id, userId: input.userId, tenantId: input.tenantId, registrationNo: input.registrationNo,
      isAiTechnician: input.isAiTechnician ?? false, serviceRadiusKm: input.serviceRadiusKm ?? 25, baseRegionId: input.baseRegionId ?? null, ratingAvg: null });
    v.events.push({ type: LivestockEventType.VetRegistered, payload: { vetId: v.props.id, userId: v.props.userId } });
    return v;
  }
  static rehydrate(props: VetProfileProps): VetProfile { return new VetProfile(props); }
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get tenantId() { return this.props.tenantId; }
  toProps(): Readonly<VetProfileProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { id: v.id, userId: v.userId, registrationNo: v.registrationNo, isAiTechnician: v.isAiTechnician, serviceRadiusKm: v.serviceRadiusKm, baseRegionId: v.baseRegionId, ratingAvg: v.ratingAvg, createdAt: v.createdAt }; }
}
