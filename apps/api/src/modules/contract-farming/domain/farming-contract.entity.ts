// modules/contract-farming/domain/farming-contract.entity.ts · the farming_contracts aggregate root.
// Lifecycle via farming-contract.state. The settlement GROSS for a grower = deliveredQty × fixed price,
// FLOAT-FREE (quantity scaled ×1000; gross = qtyMilli × fixedMinor / 1000, round-half-up). Only the FIXED
// price model is settled in this build. Money moves via the service (Law 2). No version → repo FOR UPDATE.
import { ContractStatus, assertTransition } from './farming-contract.state';
import { ContractKind, PriceModel, DomainEvent, ContractFarmingEventType } from './contract-farming.events';
import { InvalidContractError, UnsupportedPriceModelError } from './contract-farming.errors';

function roundDiv(num: bigint, den: bigint): bigint { return (num + den / 2n) / den; }

export interface FarmingContractProps {
  id: string; tenantId: string; contractNo: string; templateId: string | null; buyerUserId: string; contractKind: ContractKind;
  productId: string; totalQuantityMilli: bigint; unitCode: string; priceModel: PriceModel; priceTerms: Record<string, unknown>;
  qualitySpec: Record<string, unknown>; season: string | null; status: ContractStatus; signedAt: Date | null; createdAt?: Date;
}
export class FarmingContract {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: FarmingContractProps) {}

  static create(input: Omit<FarmingContractProps, 'status' | 'signedAt'>): FarmingContract {
    if (input.totalQuantityMilli <= 0n) throw new InvalidContractError('total quantity must be greater than zero');
    if (input.priceModel === 'fixed' && !(typeof (input.priceTerms as any)?.fixed_minor === 'string' || typeof (input.priceTerms as any)?.fixed_minor === 'number'))
      throw new InvalidContractError('fixed price model requires price_terms.fixed_minor');
    const c = new FarmingContract({ ...input, status: 'draft', signedAt: null });
    c.events.push({ type: ContractFarmingEventType.ContractCreated, payload: { contractId: c.props.id, buyerUserId: c.props.buyerUserId, productId: c.props.productId } });
    return c;
  }
  static rehydrate(props: FarmingContractProps): FarmingContract { return new FarmingContract(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get buyerUserId() { return this.props.buyerUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<FarmingContractProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  private transition(to: ContractStatus, eventType: string, extra: Record<string, unknown> = {}): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    this.events.push({ type: eventType, payload: { contractId: this.props.id, from, to, ...extra } });
  }
  propose(): void { this.transition('proposed', ContractFarmingEventType.ContractProposed); }
  sign(now: Date): void { this.transition('signed', ContractFarmingEventType.ContractSigned); this.props.signedAt = now; }
  activate(): void { this.transition('active', ContractFarmingEventType.ContractActivated); }
  fulfill(): void { this.transition('fulfilled', ContractFarmingEventType.ContractFulfilled); }
  terminate(reason?: string): void { this.transition('terminated', ContractFarmingEventType.ContractTerminated, reason ? { reason } : {}); }

  /** The fixed unit price (minor units). Throws if the contract isn't on the fixed model. */
  fixedPriceMinor(): bigint {
    if (this.props.priceModel !== 'fixed') throw new UnsupportedPriceModelError(this.props.priceModel);
    const fm = (this.props.priceTerms as any).fixed_minor;
    const v = BigInt(typeof fm === 'string' ? fm : Math.trunc(fm));
    if (v <= 0n) throw new InvalidContractError('fixed price must be greater than zero');
    return v;
  }
  /** Settlement gross for a delivered quantity (scaled ×1000) at the fixed price — float-free. */
  settlementGrossMinor(deliveredQtyMilli: bigint): bigint {
    if (deliveredQtyMilli <= 0n) throw new InvalidContractError('delivered quantity must be greater than zero');
    return roundDiv(deliveredQtyMilli * this.fixedPriceMinor(), 1000n);
  }
  toJSON() { const v = this.props; return { id: v.id, contractNo: v.contractNo, templateId: v.templateId, buyerUserId: v.buyerUserId, contractKind: v.contractKind,
    productId: v.productId, totalQuantity: (Number(v.totalQuantityMilli) / 1000).toFixed(3), unitCode: v.unitCode, priceModel: v.priceModel, priceTerms: v.priceTerms,
    season: v.season, status: v.status, signedAt: v.signedAt, createdAt: v.createdAt }; }
}
