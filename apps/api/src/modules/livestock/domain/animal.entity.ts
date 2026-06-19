// modules/livestock/domain/animal.entity.ts · the animals aggregate (the asset registry; Pashu Aadhaar/INAPH).
// Pure domain, no I/O. Lifecycle via animal.state (active → sold|deceased|lost). current_yield_lpd etc. are
// husbandry attributes; no money lives here (animal sale price flows through orders, deferred).
import { AnimalStatus, assertTransition, isActive } from './animal.state';
import { LivestockEventType, DomainEvent, AnimalRetireReason } from './livestock.events';
import { LivestockForbiddenError } from './livestock.errors';

export interface AnimalProps {
  id: string;
  tenantId: string;
  ownerUserId: string;
  speciesId: string;
  breedId: string | null;
  pashuAadhaar: string | null;
  name: string | null;
  sex: string | null;
  dobEstimated: string | null;
  parity: number | null;
  lactationStage: string | null;
  currentYieldLpd: string | null;     // numeric → keep as string to avoid float (Law: no float for precise values)
  pregnancyStatus: string | null;
  bodyConditionScore: string | null;
  status: AnimalStatus;
  acquiredVia: string | null;
  createdAt?: Date;
}

export class Animal {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: AnimalProps) {}

  static register(input: Omit<AnimalProps, 'status'>): Animal {
    const a = new Animal({ ...input, status: 'active' });
    a.events.push({ type: LivestockEventType.AnimalRegistered, payload: { animalId: a.props.id, ownerUserId: a.props.ownerUserId, speciesId: a.props.speciesId } });
    return a;
  }
  static rehydrate(props: AnimalProps): Animal { return new Animal(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get ownerUserId() { return this.props.ownerUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<AnimalProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  updateHusbandry(patch: Partial<Pick<AnimalProps, 'name' | 'breedId' | 'sex' | 'dobEstimated' | 'parity' | 'lactationStage' | 'currentYieldLpd' | 'pregnancyStatus' | 'bodyConditionScore'>>): void {
    if (!isActive(this.props.status)) throw new LivestockForbiddenError('cannot edit a retired animal');
    let changed = false;
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; (this.props as any)[k] = v; changed = true; }
    if (changed) this.events.push({ type: LivestockEventType.AnimalUpdated, payload: { animalId: this.props.id } });
  }

  retire(reason: AnimalRetireReason): void {
    assertTransition(this.props.status, reason);
    this.props.status = reason;
    this.events.push({ type: LivestockEventType.AnimalRetired, payload: { animalId: this.props.id, reason } });
  }
}
