// modules/market-intel/domain/price-alert.entity.ts · a farmer's price threshold subscription (price_alerts,
// TENANT-scoped, user-owned). isCrossedBy decides whether a new modal price fires the alert. threshold is bigint.
import { AlertDirection, DomainEvent, MarketEventType } from './market-intel.events';
import { InvalidAlertError } from './market-intel.errors';

export interface PriceAlertProps {
  id: string; tenantId: string; userId: string; productId: string; regionId: string | null; direction: AlertDirection; thresholdMinor: bigint; isActive: boolean; createdAt?: Date;
}
export class PriceAlert {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: PriceAlertProps) {}

  static create(input: Omit<PriceAlertProps, 'isActive'>): PriceAlert {
    if (input.thresholdMinor <= 0n) throw new InvalidAlertError('threshold must be positive');
    const a = new PriceAlert({ ...input, isActive: true });
    a.events.push({ type: MarketEventType.PriceAlertCreated, payload: { alertId: a.props.id, userId: a.props.userId, productId: a.props.productId } });
    return a;
  }
  static rehydrate(p: PriceAlertProps): PriceAlert { return new PriceAlert(p); }
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get isActive() { return this.props.isActive; }
  toProps(): Readonly<PriceAlertProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Does this modal price cross the threshold in the subscribed direction? */
  isCrossedBy(modalMinor: bigint): boolean {
    return this.props.direction === 'above' ? modalMinor >= this.props.thresholdMinor : modalMinor <= this.props.thresholdMinor;
  }
  activate(): void { this.props.isActive = true; }
  deactivate(): void { this.props.isActive = false; }
  toJSON() { const v = this.props; return { id: v.id, productId: v.productId, regionId: v.regionId, direction: v.direction, thresholdMinor: v.thresholdMinor.toString(), isActive: v.isActive, createdAt: v.createdAt }; }
}
