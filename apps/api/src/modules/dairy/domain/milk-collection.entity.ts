// modules/dairy/domain/milk-collection.entity.ts · the milk_collections aggregate (one row per member per
// shift per day — UNIQUE(membership_id, collected_on, shift)). The counter records weight + fat + snf; the
// amount is priced by the rate card (bigint minor units, float-free). PARTITIONED by collected_on (Law 8).
import { MilkShift, DomainEvent, DairyEventType } from './dairy.events';
import { InvalidCollectionError } from './dairy.errors';

export interface MilkCollectionProps {
  id: string;
  tenantId: string;
  mccId: string;
  membershipId: string;
  shift: MilkShift;
  collectedOn: string;          // ISO date (partition key)
  weightMilliKg: bigint;        // kg ×1000 (scaled integer; no float)
  fatCentiPct: bigint;          // % ×100
  snfCentiPct: bigint;          // % ×100
  waterFlag: boolean;
  adulterationFlags: string[];
  rateCardId: string;
  amountMinor: bigint;
  enteredBy: string | null;
  milkBillId: string | null;
  createdAt?: Date;
}

export class MilkCollection {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: MilkCollectionProps) {}

  static record(input: Omit<MilkCollectionProps, 'milkBillId'>): MilkCollection {
    if (input.weightMilliKg <= 0n) throw new InvalidCollectionError('weight must be greater than zero');
    if (input.fatCentiPct < 0n || input.fatCentiPct > 10000n) throw new InvalidCollectionError('fat % out of range');
    if (input.snfCentiPct < 0n || input.snfCentiPct > 10000n) throw new InvalidCollectionError('snf % out of range');
    if (input.amountMinor < 0n) throw new InvalidCollectionError('amount cannot be negative');
    const c = new MilkCollection({ ...input, milkBillId: null });
    c.events.push({ type: DairyEventType.CollectionRecorded, payload: { collectionId: c.props.id, membershipId: c.props.membershipId, mccId: c.props.mccId,
      shift: c.props.shift, collectedOn: c.props.collectedOn, amountMinor: c.props.amountMinor.toString() } });
    return c;
  }
  static rehydrate(props: MilkCollectionProps): MilkCollection { return new MilkCollection(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get amountMinor() { return this.props.amountMinor; }
  get weightMilliKg() { return this.props.weightMilliKg; }
  get collectedOn() { return this.props.collectedOn; }
  toProps(): Readonly<MilkCollectionProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
}
