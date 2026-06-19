// modules/equipment/domain/equipment-rate.entity.ts · the equipment_rates aggregate (per-asset rate card).
// rate_minor is bigint minor units (Law 2). UNIQUE(asset_id, rate_basis, effective_from).
import { RateBasis } from './equipment.events';
import { InvalidRateError } from './equipment.errors';

export interface EquipmentRateProps {
  id: string; assetId: string; rateBasis: RateBasis; rateMinor: bigint; includesOperator: boolean; includesFuel: boolean;
  effectiveFrom: string; effectiveTo: string | null; createdAt?: Date;
}
export class EquipmentRate {
  private constructor(private readonly props: EquipmentRateProps) {}
  static create(input: Omit<EquipmentRateProps, 'createdAt'>): EquipmentRate {
    if (input.rateMinor <= 0n) throw new InvalidRateError('rate must be greater than zero');
    return new EquipmentRate(input);
  }
  static rehydrate(props: EquipmentRateProps): EquipmentRate { return new EquipmentRate(props); }
  get id() { return this.props.id; }
  get assetId() { return this.props.assetId; }
  get rateBasis() { return this.props.rateBasis; }
  get rateMinor() { return this.props.rateMinor; }
  toProps(): Readonly<EquipmentRateProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, assetId: v.assetId, rateBasis: v.rateBasis, rateMinor: v.rateMinor.toString(),
    includesOperator: v.includesOperator, includesFuel: v.includesFuel, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo }; }
}
