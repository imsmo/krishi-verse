// modules/services-marketplace/domain/service-offering.entity.ts · the service_offerings aggregate.
// A provider lists a priced service (per_hour/day/unit/person/visit/fixed). price_minor is bigint minor
// units (Law 2). Lifecycle via service-offering.state. No version → repo locks FOR UPDATE.
import { assertTransition } from './service-offering.state';
import { PricingModel, OfferingStatus, DomainEvent, ServicesEventType } from './services-marketplace.events';
import { InvalidOfferingError } from './services-marketplace.errors';

export interface ServiceOfferingProps {
  id: string; tenantId: string; providerUserId: string; categoryId: string; defaultTitle: string; description: string | null;
  pricingModel: PricingModel; priceMinor: bigint; currencyCode: string; capacityPerSlot: number | null; serviceRadiusKm: number | null; addressId: string | null; status: OfferingStatus; createdAt?: Date;
}
export class ServiceOffering {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ServiceOfferingProps) {}
  static create(input: Omit<ServiceOfferingProps, 'status'> & { status?: OfferingStatus }): ServiceOffering {
    if (input.priceMinor <= 0n) throw new InvalidOfferingError('price must be greater than zero');
    if (!input.defaultTitle) throw new InvalidOfferingError('title required');
    return new ServiceOffering({ ...input, status: input.status ?? 'draft' });
  }
  static rehydrate(props: ServiceOfferingProps): ServiceOffering { return new ServiceOffering(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get providerUserId() { return this.props.providerUserId; }
  get status() { return this.props.status; }
  get pricingModel() { return this.props.pricingModel; }
  get priceMinor() { return this.props.priceMinor; }
  toProps(): Readonly<ServiceOfferingProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: Partial<Pick<ServiceOfferingProps, 'defaultTitle' | 'description' | 'priceMinor' | 'capacityPerSlot' | 'serviceRadiusKm' | 'addressId'>>): void {
    if (this.props.status === 'archived') throw new InvalidOfferingError('cannot edit an archived offering');
    if (patch.priceMinor !== undefined && patch.priceMinor <= 0n) throw new InvalidOfferingError('price must be greater than zero');
    let changed = false;
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; (this.props as any)[k] = v; changed = true; }
    if (changed) this.events.push({ type: ServicesEventType.OfferingUpdated, payload: { offeringId: this.props.id } });
  }
  private transition(to: OfferingStatus, eventType?: string): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    if (eventType) this.events.push({ type: eventType, payload: { offeringId: this.props.id, from, to } });
  }
  publish(): void { this.transition('published', ServicesEventType.OfferingPublished); }
  pause(): void { this.transition('paused'); }
  archive(): void { this.transition('archived', ServicesEventType.OfferingArchived); }

  /** Float-free booking total for `guests`: per_person multiplies by guests; every other model is flat. */
  totalFor(guests: number): bigint {
    if (guests <= 0) throw new InvalidOfferingError('guests must be at least 1');
    return this.props.pricingModel === 'per_person' ? this.props.priceMinor * BigInt(guests) : this.props.priceMinor;
  }
  toJSON() { const v = this.props; return { id: v.id, providerUserId: v.providerUserId, categoryId: v.categoryId, title: v.defaultTitle, description: v.description,
    pricingModel: v.pricingModel, priceMinor: v.priceMinor.toString(), currencyCode: v.currencyCode, capacityPerSlot: v.capacityPerSlot, serviceRadiusKm: v.serviceRadiusKm, status: v.status, createdAt: v.createdAt }; }
}
