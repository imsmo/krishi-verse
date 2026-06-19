// modules/livestock/domain/vet-service.entity.ts · the vet_services aggregate (a vet's priced service).
// price_minor is bigint minor units (Law 2). UNIQUE(vet_id, service_type_id) → one price per service type.
import { VetPricingUnit } from './livestock.events';
import { InvalidVetServiceError } from './livestock.errors';

export interface VetServiceProps {
  id: string;
  vetId: string;
  serviceTypeId: string;
  priceMinor: bigint;
  pricingUnit: VetPricingUnit;
  isEmergencyAvailable: boolean;
  createdAt?: Date;
}
export class VetService {
  private constructor(private props: VetServiceProps) {}
  static create(input: { id: string; vetId: string; serviceTypeId: string; priceMinor: bigint; pricingUnit?: VetPricingUnit; isEmergencyAvailable?: boolean }): VetService {
    if (input.priceMinor <= 0n) throw new InvalidVetServiceError('price must be greater than zero');
    return new VetService({ id: input.id, vetId: input.vetId, serviceTypeId: input.serviceTypeId, priceMinor: input.priceMinor,
      pricingUnit: input.pricingUnit ?? 'per_visit', isEmergencyAvailable: input.isEmergencyAvailable ?? false });
  }
  static rehydrate(props: VetServiceProps): VetService { return new VetService(props); }
  get id() { return this.props.id; }
  get vetId() { return this.props.vetId; }
  get priceMinor() { return this.props.priceMinor; }
  toProps(): Readonly<VetServiceProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, vetId: v.vetId, serviceTypeId: v.serviceTypeId, priceMinor: v.priceMinor.toString(), pricingUnit: v.pricingUnit, isEmergencyAvailable: v.isEmergencyAvailable }; }
}
